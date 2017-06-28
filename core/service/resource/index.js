"use strict";

const lodash = require('lodash');
const globalconfig = require('config');
const logger = require('../../lib/logger')('service:resource');
const elastic = require('../../lib/elastic');
const Constants = require('../../constants/monitors');
const CustomerService = require('../customer');
const NotificationService = require('../notification');
const ResourceMonitorService = require('./monitor');
const EventDispatcher = require('../events');
const ResourcesNotifications = require('./notifications');
const Job = require('../../entity/job').Job;
const AgentUpdateJob = require('../../entity/job').AgentUpdate;
const MonitorEvent = require('../../entity/event').MonitorEvent;
const ResourceModel = require('../../entity/resource').Entity;
const MonitorModel = require('../../entity/monitor').Entity;
const MonitorTemplate = require('../../entity/monitor/template').Entity;
const Host = require('../../entity/host').Entity;
const HostGroup = require('../../entity/host/group').Entity;
const HostStats = require('../../entity/host/stats').Entity;
const Task = require('../../entity/task').Entity;
const Tag = require('../../entity/tag').Entity;

function Service(resource) {
  var _resource = resource;

  function logStateChange (resource,input) {
    var data = {
      date: (new Date()).toISOString(),
      timestamp: (new Date()).getTime(),
      state: input.state,
      hostname: resource.hostname,
      customer_name: resource.customer_name,
      resource_id: resource._id,
      resource_name: resource.name,
      resource_type: resource.type,
      type: 'resource-stats'
    };

    var key = globalconfig.elasticsearch.keys.resource.stats;
    elastic.submit(resource.customer_name,key,data);
  }

  function dispatchStateChangeSNS (resource, options) {
    NotificationService.sendSNSNotification(resource,{
      topic:'events',
      subject:'resource_update'
    });
  }


  function sendResourceEmailAlert (resource,input) {
    if (resource.alerts===false) return;

    MonitorModel
      .findOne({ resource_id: resource._id })
      .exec(function(err,monitor){
        resource.monitor = monitor
        var specs = lodash.assign({},input,{ resource: resource });

        ResourcesNotifications(specs,(error,details) => {
          if (error) {
            if ( /event ignored/.test(error.message) === false ) {
              logger.error(error);
            }
            logger.log('email alerts not sent.');
            return;
          }

          logger.log('sending email alerts');
          CustomerService.getAlertEmails(
            resource.customer_name,
            (error,emails) => {
              var mailTo, extraEmail=[];

              if (Array.isArray(resource.acl) && resource.acl.length>0) {
                extraEmail = resource.acl.filter(email => {
                  emails.indexOf(email) === -1
                });
              }

              mailTo = (extraEmail.length>0) ? emails.concat(extraEmail) : emails;

              NotificationService.sendEmailNotification({
                to: mailTo.join(','),
                customer_name: resource.customer_name,
                subject: details.subject,
                content: details.content
              });
            }
          );
        });
      })
  }

  function dispatchResourceEvent (resource,eventName){
    MonitorModel.findOne({
      resource_id: resource._id
    },function(err,monitor){
      if (!monitor) {
        logger.error('resource monitor not found %j', resource);
        return;
      }

      logger.log('searching monitor %s event %s ', monitor.name, eventName);

      MonitorEvent.findOne({
        emitter_id: monitor._id,
        //emitter: monitor._id,
        enable: true,
        name: eventName
      },function(err, event){
        if (err) return logger.error(err);
        else if (!event) return;

        EventDispatcher.dispatch(event);
      });
    });
  }


  function handleFailureState (resource,input,config) {
    var newState = Constants.RESOURCE_FAILURE;
    var failure_threshold = config.fails_count_alert;
    logger.log('resource "%s" check fails.', resource.name);

    resource.last_event = input;

    resource.fails_count++;
    logger.log(
      'resource %s[%s] failure event count %s/%s', 
      resource.name, 
      resource._id,
      resource.fails_count,
      failure_threshold
    );

    // current resource state
    if (resource.state != newState) {
      // is it time to start sending failure alerts?
      if (resource.fails_count >= failure_threshold) {
        logger.log('resource "%s" state failure', resource.name);

        input.event||(input.event=input.state);
        input.failure_severity = getEventSeverity(input.event,resource);
        resource.state = newState;

        sendResourceEmailAlert(resource,input);
        logStateChange(resource,input);
        dispatchStateChangeSNS(resource,{
          message:'monitor failure',
          data:input
        });
        dispatchResourceEvent(resource,Constants.RESOURCE_FAILURE);
      }
    }
  }

  function needToSendUpdatesStoppedEmail (resource) {
    return resource.type === Constants.RESOURCE_TYPE_HOST ||
      resource.failure_severity === Constants.MONITOR_SEVERITY_CRITICAL;
  }

  function handleNormalState (resource,input,config) {
    logger.log('"%s"("%s") state is normal', resource.name, resource.type);

    var failure_threshold = config.fails_count_alert;
    var isRecoveredFromFailure = Boolean(resource.state===Constants.RESOURCE_FAILURE);

    resource.last_event = input;

    // failed at least once
    if (resource.fails_count!==0||resource.state!==Constants.RESOURCE_NORMAL) {
      resource.state = Constants.RESOURCE_NORMAL;
      // resource failure was alerted ?
      if (resource.fails_count >= failure_threshold) {
        logger.log('"%s" has been restored', resource.name);

        if (isRecoveredFromFailure) {
          input.event||(input.event=input.state);
        } else {
          // is recovered from "stop sending updates"
          input.event = Constants.RESOURCE_RECOVERED;
        }

        input.failure_severity = getEventSeverity(input.event,resource);

        if (!isRecoveredFromFailure) {
          if (needToSendUpdatesStoppedEmail(resource)) {
            sendResourceEmailAlert(resource,input);
          }
        } else {
          sendResourceEmailAlert(resource,input);
        }

        logStateChange(resource,input);
        dispatchResourceEvent(resource,Constants.RESOURCE_RECOVERED);
        dispatchStateChangeSNS(resource,{
          message:(input.message||'monitor normal'),
          data:input
        });
      }

      logger.log('state restarted');
      // reset state
      resource.fails_count = 0;
    }
  }

  function handleUpdatesStoppedState (resource,input,config) {
    var newState = Constants.RESOURCE_STOPPED;
    var failure_threshold = config.fails_count_alert;

    resource.fails_count++;
    logger.log(
      'resource %s[%s] notifications stopped count %s/%s',
      resource.name,
      resource._id,
      resource.fails_count,
      failure_threshold
    );

    // current resource state
    if (resource.state != newState) {
      if (resource.fails_count >= failure_threshold) {
        logger.log('resource "%s" notifications stopped', resource.name);

        input.event||(input.event=input.state); // state = agent or resource stopped
        input.failure_severity = getEventSeverity(input.event,resource);

        resource.state = newState;

        if (needToSendUpdatesStoppedEmail(resource)) {
          sendResourceEmailAlert(resource,input);
        }
        logStateChange(resource,input);
        dispatchResourceEvent(resource,Constants.RESOURCE_STOPPED);
        dispatchStateChangeSNS(resource,{
          message:'updates stopped',
          data:input
        });
      }
    }
  }

  /**
   *
   * espeshial case of monitor state changed.
   * the resource was updated or changed or was not present and currently created.
   * the monitor trigger the changed event and the supervisor emmit the event internally
   *
   */
  function handleChangedStateEvent (resource,input,config) {
    resource.last_event = input;
    input.failure_severity = getEventSeverity(input.event,resource);
    sendResourceEmailAlert(resource,input);
    dispatchResourceEvent(resource,Constants.RESOURCE_CHANGED);
    logStateChange(resource,input);
    dispatchStateChangeSNS(resource,{
      message: 'file changed',
      data: input
    });
  }

  function isSuccess (state) {
    return Constants.SUCCESS_STATES.indexOf( state.toLowerCase() ) != -1 ;
  }
  function isFailure (state) {
    return Constants.FAILURE_STATES.indexOf( state.toLowerCase() ) != -1 ;
  }

  /**
   *
   * @private
   * @param String state
   * @return String
   *
   */
  function filterStateEvent (state) {
    if (!state||typeof state != 'string') return Constants.RESOURCE_ERROR;

    // is a recognized state
    if (Constants.MONITOR_STATES.indexOf(state) !== -1) return state;
    if (isSuccess(state)) return Constants.RESOURCE_NORMAL;
    if (isFailure(state)) return Constants.RESOURCE_FAILURE;
    // if no state is defined , return error
    return Constants.RESOURCE_ERROR;
  }

  /**
   * @public
   * @param Object input
   * @param Function next
   * @return null
   */
  this.handleState = function (input,next) {
    next||(next=function(){});
    var resource = _resource;

    var state = filterStateEvent(input.state);
    input.state = state;

    if (input.last_update) resource.last_update = input.last_update;
    if (input.last_check) resource.last_check = input.last_check;

    logger.data('resource state [%s] > %o', resource.name, input);

    CustomerService.getCustomerConfig(
      resource.customer_id,
      (err,config) => {
        if (err||!config) {
          throw new Error('customer config unavailable');
        }
        var monitorConfig = config.monitor;

        switch (input.state) {
          case Constants.RESOURCE_CHANGED:
            handleChangedStateEvent(resource,input,monitorConfig);
            break;
          // monitoring update event. detected stop
          case Constants.AGENT_STOPPED:
          case Constants.RESOURCE_STOPPED:
            handleUpdatesStoppedState(resource,input,monitorConfig);
            break;
          case Constants.RESOURCE_NORMAL:
            resource.last_update = new Date();
            handleNormalState(resource,input,monitorConfig);
            break;
          default:
          case Constants.RESOURCE_FAILURE:
            resource.last_update = new Date();
            handleFailureState(resource,input,monitorConfig);
            break;
        }

        resource.save(err => {
          if (err) {
            logger.error('error saving resource state');
            logger.error(err, err.errors);
          }
        });

        // submit monitor result to elastic search
        var key = globalconfig.elasticsearch.keys.monitor.execution;
        input.name = resource.name;
        input.type = resource.type;
        input.customer_name = resource.customer_name;
        elastic.submit(resource.customer_name,key,input);

        next();
      }
    );
  }
}

module.exports = Service;

function registerResourceCRUDOperation(customer,data) {
  var key = globalconfig.elasticsearch.keys.monitor.crud;
  elastic.submit(customer,key,data);
}

Service.populate = function (resource,done) {
  return resource.populate({},done)
}

Service.populateAll = function (resources,next) {
  var result = []
  if (!Array.isArray(resources) || resources.length === 0) {
    return next(null,result)
  }

  const populated = lodash.after(resources.length,() => next(null,result))

  for (var i=0;i<resources.length;i++) {
    const resource = resources[i]
    this.populate(resource,() => {
      result.push(resource) // populated resource
      populated()
    })
  }
}

Service.findHostResources = function(host,options,done) {
  var query = { 'host_id': host._id };
  if(options.type) query.type = options.type;
  ResourceModel.find(query,(err,resources)=>{
    if(err){
      logger.error(err);
      return done(err);
    }
    if(!resources||resources.length===0){
      logger.log('host resources not found for host %s', host.hostname);
      return done();
    }
    if(options.ensureOne){
      if(resources.length>1){
        logger.error('more than one resource found for host %s type %s', host.hostname, options.type);
        return done();
      }
      else return done(null,resources[0]);
    }
    done(null,resources);
  });
}

/**
 *
 * create entities
 * @author Facugon
 * @param {Object} input
 *
 */
Service.create = function (input, next) {
  next||(next=function(){});
  logger.log('creating resource for host %j', input);
  var type = (input.type||input.monitor_type);

  ResourceMonitorService.setMonitorData(type,input,function(error,monitor_data){
    if (error) {
      return next(error);
    }
    if (!monitor_data) {
      var e = new Error('invalid resource data');
      e.statusCode = 400;
      return next(e);
    }

    createResourceAndMonitor({
      resource_data: lodash.extend({},input,{
        name: input.name,
        type: type,
      }),
      monitor_data: monitor_data
    },function(error,result){
      var monitor = result.monitor;
      var resource = result.resource;
      logger.log('resource & monitor created');
      registerResourceCRUDOperation(
        monitor.customer_name,{
          name: monitor.name,
          type: resource.type,
          customer_name: monitor.customer_name,
          user_id: input.user_id,
          user_email: input.user_email,
          operation: 'create'
        }
      );

      Service.createDefaultEvents(monitor,input.customer)
      Tag.create(input.tags,input.customer);
      AgentUpdateJob.create({ host_id: monitor.host_id });
      next(null,result);
    });
  });
}

Service.createDefaultEvents = (monitor,customer,done) => {
  // CREATE DEFAULT EVENT
  const base = {
    customer_id: customer._id,
    customer: customer,
    emitter: monitor, 
    emitter_id: monitor._id
  }

  MonitorEvent.create(
    // NORMAL state does not trigger EVENT
    //{ customer: customer, emitter: monitor, name: Constants.RESOURCE_NORMAL } ,
    Object.assign({}, base, { name: Constants.RESOURCE_RECOVERED }) ,
    Object.assign({}, base, { name: Constants.RESOURCE_STOPPED }) ,
    Object.assign({}, base, { name: Constants.RESOURCE_FAILURE }) ,
    (err) => {
      if (err) logger.error(err)
    }
  );

  if (monitor.type === Constants.RESOURCE_TYPE_FILE) {
    MonitorEvent.create({
      customer: customer,
      emitter: monitor,
      emitter_id: monitor._id,
      name: Constants.RESOURCE_CHANGED
    }, err => {
      if (err) logger.error(err);
    });
  }
}

/**
 *
 * update entities
 *
 */
Service.update = function(input,next) {
  var updates = input.updates;
  var resource = input.resource;

  logger.log('updating monitor %j',updates);

  // remove from updates if present. cant be changed
  delete updates.monitor
  delete updates.customer
  delete updates.template

  resource.update(updates,function(error){
    if (error) {
      logger.error(error);
      return next(error);
    }

    MonitorModel.findOne({
      resource_id: resource._id
    },function(error,monitor){
      if (error) return next(error);
      if (!monitor) return next(new Error('resource monitor not found'), null);

      var previous_host_id = monitor.host_id;
      monitor.update(updates,function(error){
        if(error) return next(error);

        registerResourceCRUDOperation(
          monitor.customer_name,{
            name: monitor.name,
            type: resource.type,
            customer_name: monitor.customer_name,
            user_id: input.user_id,
            user_email: input.user_email,
            operation: 'update'
          }
        );

        AgentUpdateJob.create({ host_id: updates.host_id });
        // if monitor host changes, the new and the old agents should be notified
        if(previous_host_id != updates.host_id){
          AgentUpdateJob.create({ host_id: previous_host_id });
        }

        Tag.create(updates.tags,{ _id: resource.customer_id });
        next(null,resource);
      });
    });
  });
}

function getEventSeverity (event,resource) {
  logger.log('resource event is "%s"', event);

  // severity is set and is valid
  if (
    resource.failure_severity &&
    Constants.MONITOR_SEVERITIES.indexOf(resource.failure_severity.toUpperCase()) !== -1
  ) {
    return resource.failure_severity;
  }

  // else try to determine the severity
  if (event && /^host:stats:.*$/.test(event)) {
    return 'LOW';
  } else {
    return 'HIGH';
  }
}

/**
 *
 * static methods
 *
 */
Service.fetchBy = function (filter,next) {
  ResourceModel.fetchBy(filter,function (err,resources) {
    if (resources.length===0) return next(null,[])

    const pub = []
    const fetched = lodash.after(resources.length,() => {
      next(null, pub)
    })

    resources.forEach(resource => {
      var data = resource.toObject()

      MonitorModel.findOne({
        resource_id: resource._id
      }).exec((err,monitor) => {
        if (err) {
          logger.error('%o',err)
          return fetched()
        }

        data.monitor = monitor.toObject()
        pub.push(data)
        fetched()
      })
    })
  })
}

/**
 *
 * @author Facundo
 * @param {Object} input
 * @param {Resource} input.resource the resource to be removed
 * @param {User} input.user requesting user
 * @param {Function(Error)} done
 *
 */
Service.removeHostResource = function (input, done) {
  const host_id = input.resource.host_id
  const resource_id = input.resource._id

  logger.log('removing host "%s" resource "%s" resources', host_id, resource_id);

  // find and remove host
  Host
    .findById(host_id)
    .exec(function(err, item){
      if (err) {
        logger.error(err);
        return
      }
      if (!item) return
      item.remove((err) => {
        if (err) logger.error(err)
      });
    });

  logger.log('removing host stats');
  // find and remove saved cached host stats
  HostStats
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err);
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove resources
  const removeResource = (resource, done) => {
    logger.log('removing host resource "%s"', resource.name);
    Service.remove({
      resource: resource,
      notifyAgents: false,
      user: input.user
    },(err) => {
      if (err) {
        logger.error(err);
        return
      }
      else logger.log('resource "%s" removed', resource.name)
      done(err)
    });
  }

  ResourceModel
    .find({ host_id: host_id })
    .exec(function(err, resources){
      if (err) {
        logger.error(err);
        return
      }
      if (!Array.isArray(resources)||resources.length===0) return
      const resourceRemoved = lodash.after(resources.length, () => {
        // all resources && monitors removed
      })

      for (var i=0; i<resources.length; i++) {
        removeResource(resources[i], resourceRemoved)
      }
    })

  // find and remove host jobs
  Job
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err);
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove host tasks
  Task
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err);
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].host_id = null
        items[i].save()
      }
    });

  const removeFromGroup = (group) => {
    const idx = group.hosts.indexOf(host_id)
    if (idx === -1) return
    group.hosts.splice(idx,1)
    group.save()
  }

  HostGroup
    .find({ hosts: host_id })
    .exec((err,groups) => {
      if (err) {
        logger.error(err);
        return
      }
      if (!Array.isArray(groups) || groups.length===0) return
      for (var i=0; i<groups.length; i++) {
        removeFromGroup(groups[i])
      }
    })
}

/**
 *
 * @author Facundo
 *
 */
Service.remove = function (input, done) {
  done||(done=function(){});

  var resource = input.resource;
  var notifyAgents = input.notifyAgents;

  logger.log('removing resource "%s" monitors', resource.name);

  MonitorModel.find({
    resource_id: resource._id
  },function(error,monitors){
    if(monitors.length !== 0){
      var monitor = monitors[0];
      monitor.remove(function(err){
        if(err) return logger.error(err);

        MonitorEvent.remove({
          emitter_id: monitor._id
        }, (err) => {
          if (err) logger.error(err)
        })

        logger.log('monitor %s removed', monitor.name);
        if(notifyAgents) {
          AgentUpdateJob.create({ host_id: monitor.host_id });
        }
      });
    } else {
      logger.error('monitor not found.');
    }

    resource.remove(function(err){
      if(err) return done(err);

      registerResourceCRUDOperation(
        resource.customer_name,{
          'name':resource.name,
          'type':resource.type,
          'customer_name':resource.customer_name,
          'user_id':input.user.id,
          'user_email':input.user.email,
          'operation':'delete'
        }
      );

      done();
    });
  });
}

Service.disableResourcesByCustomer = function(customer, doneFn){
  ResourceModel
    .find({ 'customer_id': customer._id })
    .exec(function(error, resources){
      if(resources.length != 0){
        for(var i=0; i<resources.length; i++){
          var resource = resources[i];

          resource.enable = false;
          resource.save(error => {
            if(error) {
              logger.log('ERROR updating resource property');
              throw error;
            }
          });
        }
      }
    });
}

/**
 *
 * API to create multiple resource and monitor linked to a host
 * @author Facugon
 * @param Array hosts
 * @param Object input
 * @param Function done
 * @return null
 *
 */
Service.createResourceOnHosts = function(hosts,input,done) {
  done||(done=()=>{});
  logger.log('preparing to create resources');
  logger.log(input);
  var errors = null;
  var monitors = [];

  var completed = lodash.after(hosts.length, function(){
    logger.log('all hosts processed');
    done(errors, monitors);
  });

  var hostProcessed = function(hostId, error, data){
    if (error) {
      errors = errors||{};
      logger.log('there are some error %o', error);
      errors[ hostId ] = error.message;
    } else {
      logger.log('host resource and monitor created');
      monitors.push( data );
    }
    completed();
  }

  for (var i=0; i<hosts.length; i++) {
    var hostId = hosts[i];
    handleHostIdAndData(hostId,input,function(error,result){
      hostProcessed(hosts[i], error, result);
    });
  }
}

/**
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {Object} options
 * @param {Host} options.host
 * @param {Customer} options.customer
 * @param {ResourceTemplate} options.template
 * @param {Function(Error,Resource)} options.done
 *
 */
Service.createFromTemplate = function(options) {
  const done = options.done || (() => {})
  const template = options.template
  const host = options.host
  const customer = options.customer

  const generateResourceModel = () => {
    const input = lodash.extend(template.toObject(), {
      host: host._id,
      host_id: host._id,
      hostname: host.hostname,
      template: template._id,
      template_id: template._id,
      last_update: new Date(),
      last_event: {},
      _type: 'Resource'
    })
    // remove template _id
    delete input.id
    delete input._id
    logger.log('creating resource from template %j', input)
    return new ResourceModel(input)
  }

  const generateMonitorModel = () => {
    const input = lodash.extend(template.monitor_template.toObject(), {
      host: host,
      host_id: host._id,
      template: template.monitor_template_id,
      template_id: template.monitor_template_id,
      customer: resource.customer_id,
      customer_id: resource.customer_id,
      customer_name: resource.customer_name,
      _type: 'ResourceMonitor'
    })
    // remove template _id
    delete input._id
    delete input.id
    logger.log('creating monitor from template %j', input)
    return new MonitorModel(input)
  }

  var resource = generateResourceModel(template)
  var monitor = generateMonitorModel(template)

  // the ids are generated as soon as the models are created.
  // dont need to save them before
  resource.monitor_id = monitor._id
  resource.monitor = monitor._id

  monitor.resource_id = resource._id
  monitor.resource = resource._id

  resource.save(err => {
    if (err) {
      logger.error('%o',err)
      return done(err)
    }

    monitor.save(err => {
      if(err) {
        logger.error('%o',err)
        return done(err);
      }

      Service.createDefaultEvents(monitor, customer)

      resource.monitor = monitor
      done(null,resource)
    })
  })
}

/**
 *
 *
 * @author Facugon
 *
 */
function handleHostIdAndData (hostId, input, doneFn) {
  Host.findById(hostId, function(err,host){
    if (err) return doneFn(err);

    if (!host) {
      var e = new Error('invalid host id ' + hostId);
      e.statusCode = 400;
      return doneFn(e);
    }

    input.host_id = host._id
    input.host = host._id
    input.hostname = host.hostname

    Service.create(input, doneFn)
  });
}

/**
 *
 * create entities
 *
 */
function createResourceAndMonitor (input, done) {
  var monitor_data = input.monitor_data;
  var resource_data = input.resource_data;

  logger.log('creating resource');
  ResourceModel.create(resource_data, function(error,resource){
    if(error) throw error;
    else {
      logger.log('creating resource %s monitor', resource._id);
      logger.log(monitor_data);

      // monitor.resource is used to populate the entity. need refactor
      monitor_data.resource = resource._id;
      monitor_data.resource_id = resource._id;

      MonitorModel.create(
        monitor_data,
        function(error, monitor){
          if(error) throw error;
          return done(null,{
            'resource': resource, 
            'monitor': monitor 
          });
        }
      );
    }
  });
}

/**
 *
 * @author Facundo
 * @param {Object} script, a script entity
 * @return null
 *
 */
function updateMonitorsWithDeletedScript (script,done) {
  done=done||function(){};

  logger.log('searching script "%s" resource-monitor', script._id);
  var query = { 'type': 'script', 'script': script._id };
  var options = { 'populate': true };

  ResourceMonitorService.findBy(
    query,
    options,
    function(error, monitors){
      if(!monitors||monitors.length==0){
        logger.log('no monitores linked to the script found.');
        return done();
      }

      for(var i=0; i<monitors.length; i++) {
        var monitor = monitors[i];
        detachMonitorScript (monitor);
      }
    }
  );
}

function detachMonitorScript (monitor, done) {
  done=done||function(){};
  if (!monitor.resource._id) {
    var err = new Error('populate monitor first. resource object required');
    logger.error(err);
    return done(err);
  }

  var resource = monitor.resource;
  resource.enable = false;
  resource.save(function(error){
    if (error) return logger.error(error);
    monitor.enable = false;
    monitor.config.script_id = null;
    monitor.config.script_arguments = [];
    monitor.save(function(error){
      if (error) return logger.error(error);
      logger.log('monitor changes saved');
      logger.log('notifying "%s"', monitor.host_id);
      AgentUpdateJob.create({ host_id: monitor.host_id });
    });
  });
}

/**
*
* search script-monitor and create a notify job to the monitor agents.
*
* @author Facundo
* @param {Object} script, a script entity
* @return null
*
*/
function notifyScriptMonitorsUpdate (script) {
  var query = {
    'type':'script',
    'script':script._id
  };
  ResourceMonitorService.findBy(query,function(error, monitors){
    if(!monitors||monitors.length==0){
      logger.log('no monitors with this script attached found.');
      return;
    }

    var hosts = [];
    // create one notification for each host
    for(var i=0; i<monitors.length; i++){
      var monitor = monitors[i];
      if( hosts.indexOf(monitor.host_id) === -1 ){
        hosts.push(monitor.host_id);
      }
    }

    for(var i=0;i<hosts.length;i++){
      var host = hosts[i];
      logger.log('notifying host "%s"', host);
      AgentUpdateJob.create({ host_id: host });
    }
  });
}

Service.onScriptRemoved = function (script) {
  updateMonitorsWithDeletedScript(script);
}

Service.onScriptUpdated = function(script){
  notifyScriptMonitorsUpdate(script);
}
