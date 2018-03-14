"use strict"

const App = require('../../app')
const after = require('lodash/after')
const assign = require('lodash/assign')
const logger = require('../../lib/logger')('service:resource')
const elastic = require('../../lib/elastic')
const CustomerService = require('../customer')
const NotificationService = require('../notification')
const ResourceMonitorService = require('./monitor')
const ResourcesNotifications = require('./notifications')

const EventConstants = require('../../constants/events')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const MONITORS = require('../../constants/monitors')
const Lifecycle = require('../../constants/lifecycle')
// Entities
const AgentUpdateJob = require('../../entity/job').AgentUpdate
const MonitorEvent = require('../../entity/event').MonitorEvent
const ResourceModel = require('../../entity/resource').Entity
const MonitorModel = require('../../entity/monitor').Entity
const MonitorTemplate = require('../../entity/monitor/template').Entity
const Host = require('../../entity/host').Entity
const Tag = require('../../entity/tag').Entity
//const dbFilter = require('../lib/db-filter')

function Service (resource) {
  var _resource = resource;

  function logStateChange (resource,input) {
    const data = {
      hostname: resource.hostname,
      event_name: input.event_name,
      state: input.state,
      organization: resource.customer_name,
      id: resource._id,
      name: resource.name,
      type: resource.type,
      operation: Constants.UPDATE
    }
    const topic = TopicsConstants.monitor.state
    elastic.submit(resource.customer_name, topic, data) // topic = topics.monitor.state
  }

  const sendStateChangeEventNotification = (resource, eventName) => {
    const topic = TopicsConstants.monitor.state
    NotificationService.generateSystemNotification({
      topic: topic,
      data: {
        model_type: 'Resource',
        model: resource,
        hostname: resource.hostname,
        organization: resource.customer_name,
        operation: Constants.UPDATE,
        monitor_event: eventName
      }
    })
  }

  const sendResourceEmailAlert = (resource,input) => {
    if (resource.alerts===false) return
    if (resource.failure_severity=='low'.toUpperCase()) return

    let query = MonitorModel.findOne({ resource_id: resource._id })
    query.exec(function(err,monitor){
      resource.monitor = monitor
      var specs = assign({},input,{ resource: resource });

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

  /**
   *
   * @param {String} resource_id
   * @param {String} trigger triggered event name
   *
   */
  const dispatchWorkflowEvent = (resource_id, trigger, data) => {
    MonitorModel.findOne({
      resource_id: resource_id
    }, function (err,monitor) {
      if (!monitor) {
        logger.error('resource monitor not found %s', resource_id);
        return;
      }

      logger.log('searching monitor %s event %s ', monitor.name, trigger);

      MonitorEvent.findOne({
        emitter_id: monitor._id,
        enable: true,
        name: trigger
      },function(err, event){
        if (err) return logger.error(err);
        else if (!event) return;

        App.eventDispatcher.dispatch({
          eventName: EventConstants.WORKFLOW_EVENT,
          event,
          data
        })
      })
    })
  }

  function needToSendUpdatesStoppedEmail (resource) {
    return resource.type === MONITORS.RESOURCE_TYPE_HOST ||
      resource.failure_severity === MONITORS.MONITOR_SEVERITY_CRITICAL;
  }

  const handleFailureState = (resource,input,config) => {
    const newState = MONITORS.RESOURCE_FAILURE;
    const failure_threshold = config.fails_count_alert;
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

        input.event_name = input.event || newState
        input.failure_severity = getEventSeverity(input.event_name,resource);
        resource.state = newState;

        sendResourceEmailAlert(resource,input);
        logStateChange(resource,input);
        sendStateChangeEventNotification(resource,input.event_name)
        dispatchWorkflowEvent(resource._id, input.event_name, input.data)
      }
    }
  }

  const handleNormalState = (resource,input,config) => {
    const newState = MONITORS.RESOURCE_NORMAL
    logger.log('"%s"("%s") state is normal', resource.name, resource.type);

    const failure_threshold = config.fails_count_alert;
    const isRecoveredFromFailure = Boolean(resource.state===MONITORS.RESOURCE_FAILURE);

    resource.last_event = input;

    // failed at least once
    if (resource.fails_count!==0||resource.state!==newState) {
      resource.state = newState;
      // resource failure was alerted ?
      if (resource.fails_count >= failure_threshold) {
        logger.log('"%s" has been restored', resource.name);

        if (input.event) {
          input.event_name = input.event
        } else {
          // to trigger the state change event
          if (isRecoveredFromFailure) {
            input.event_name = MONITORS.RESOURCE_RECOVERED
          } else {
            // is recovered from updates_stopped
            input.event_name = MONITORS.RESOURCE_STARTED
          }
        }

        input.failure_severity = getEventSeverity(input.event_name, resource);

        if (!isRecoveredFromFailure) {
          if (needToSendUpdatesStoppedEmail(resource)) {
            sendResourceEmailAlert(resource,input);
          }
        } else {
          sendResourceEmailAlert(resource,input);
        }

        logStateChange(resource,input);
        dispatchWorkflowEvent(resource._id, input.event_name, input.data)
        sendStateChangeEventNotification(resource, input.event_name)
      }

      logger.log('state restarted');
      // reset state
      resource.fails_count = 0;
    }
  }

  const handleUpdatesStoppedState = (resource,input,config) => {
    const newState = MONITORS.RESOURCE_STOPPED
    const failure_threshold = config.fails_count_alert
    resource.fails_count++

    logger.log(
      'resource %s[%s] notifications stopped count %s/%s',
      resource.name,
      resource._id,
      resource.fails_count,
      failure_threshold
    )

    const resourceUpdatesStopped = resource.state != newState &&
      resource.fails_count >= failure_threshold

    const dispatchNotifications = () => {
      if (needToSendUpdatesStoppedEmail(resource)) {
        sendResourceEmailAlert(resource,input)
      }

      logStateChange(resource,input)
      dispatchWorkflowEvent(resource._id, input.event_name, input.data)
      sendStateChangeEventNotification(resource, input.event_name)
    }

    // current resource state
    if (resourceUpdatesStopped) {
      logger.log('resource "%s" notifications stopped', resource.name)
      input.event_name = input.event || MONITORS.RESOURCE_STOPPED
      input.failure_severity = getEventSeverity(input.event_name, resource)
      resource.state = newState
      dispatchNotifications()

      // if the resource is a host
      const isHost = (resource.type === MONITORS.RESOURCE_TYPE_HOST)
      if (isHost) {
        cancelAssignedJobsToHost(resource.host_id)
      }
    }
  }

  /**
   *
   * espeshial case of monitor state changed.
   * the resource was updated or changed or was not present and currently created.
   * the monitor trigger the changed event and the supervisor emit the event internally
   *
   * this is emitted only once to trigger the change event
   *
   */
  function handleChangedStateEvent (resource,input,config) {
    const newState = MONITORS.RESOURCE_NORMAL
    resource.last_event = input
    resource.state = newState
    input.event_name = input.event || MONITORS.RESOURCE_CHANGED
    input.failure_severity = getEventSeverity(input.event_name, resource)
    sendResourceEmailAlert(resource, input)
    dispatchWorkflowEvent(resource._id, input.event_name, input.data)
    logStateChange(resource, input)
    sendStateChangeEventNotification(resource, input.event_name)
  }

  /**
   *
   * @private
   * @param String state
   * @return String
   *
   */
  function isSuccess (state) {
    return MONITORS.SUCCESS_STATES.indexOf(state.toLowerCase()) != -1
  }
  function isFailure (state) {
    return MONITORS.FAILURE_STATES.indexOf(state.toLowerCase()) != -1
  }
  function filterStateEvent (state) {
    if (!state || typeof state != 'string') {
      return MONITORS.RESOURCE_ERROR
    }

    // state is a recognized state
    if (MONITORS.MONITOR_STATES.indexOf(state) !== -1) {
      return state
    }

    if (isSuccess(state)) {
      return MONITORS.RESOURCE_NORMAL
    }
    if (isFailure(state)) {
      return MONITORS.RESOURCE_FAILURE
    }
    return MONITORS.RESOURCE_ERROR
  }

  /**
   * @public
   * @param Object input
   * @param Function next
   * @return null
   */
  this.handleState = function (input,next) {
    next || (next=function(){})
    const resource = _resource
    const state = filterStateEvent(input.state)
    input.state = state

    resource.last_check = new Date()

    CustomerService.getCustomerConfig(resource.customer_id, (err,config) => {
      if (err || !config) {
        throw new Error('customer config unavailable')
      }

      const monitorConfig = config.monitor

      switch (state) {
        case MONITORS.RESOURCE_CHANGED:
          handleChangedStateEvent(resource, input, monitorConfig)
          break
        case MONITORS.AGENT_STOPPED:
        case MONITORS.RESOURCE_STOPPED:
          handleUpdatesStoppedState(resource, input, monitorConfig)
          break
        case MONITORS.RESOURCE_NORMAL:
          resource.last_update = new Date()
          handleNormalState(resource, input, monitorConfig)
          break
        default:
        case MONITORS.RESOURCE_FAILURE:
          resource.last_update = new Date()
          handleFailureState(resource, input, monitorConfig)
          break
      }

      resource.save(err => {
        if (err) {
          logger.error('error saving resource state')
          logger.error(err, err.errors)
        }
      })

      //input.hostname = resource.hostname
      //input.name = resource.name
      //input.type = resource.type
      //input.customer_name = resource.customer_name

      let payload = {
        hostname: resource.hostname,
        organization: resource.customer_name,
        model_name: resource.name,
        model_type: resource.type,
        model_id: resource._id,
        operation: Constants.UPDATE,
        result: resource.last_event.data,
        state: resource.state
      }

      // submit monitor result to elastic search
      const topic = TopicsConstants.monitor.execution
      elastic.submit(resource.customer_name, topic, payload) // topic = topics.monitor.execution

      next()
    })
  }
}

module.exports = Service;

Service.populate = function (resource,done) {
  return resource.populate({},done)
}

Service.populateAll = function (resources,next) {
  var result = []
  if (!Array.isArray(resources) || resources.length === 0) {
    return next(null,result)
  }

  const populated = after(resources.length,() => next(null,result))

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
  next||(next=function(){})
  logger.log('creating resource for host %j', input)
  var type = (input.type||input.monitor_type)

  ResourceMonitorService.setMonitorData(type,input,function(error,monitor_data){
    if (error) {
      return next(error)
    }
    if (!monitor_data) {
      var e = new Error('invalid resource data')
      e.statusCode = 400
      return next(e)
    }

    createResourceAndMonitor({
      resource_data: assign({},input,{
        name: input.name,
        type: type,
      }),
      monitor_data: monitor_data
    }, function (error,result) {
      var monitor = result.monitor;
      var resource = result.resource;
      logger.log('resource & monitor created');

      const topic = TopicsConstants.monitor.crud
      elastic.submit(monitor.customer_name, topic, { // topic = topics.monitor.crud , BULK CREATE
        hostname: monitor.hostname,
        organization: monitor.customer_name,
        model_id: monitor._id,
        model_name: monitor.name,
        model_type: monitor.type,
        user_id: input.user._id,
        user_email: input.user.email,
        user_name: input.user.username,
        operation: Constants.CREATE
      })

      Service.createDefaultEvents(monitor,input.customer)
      Tag.create(input.tags,input.customer)
      AgentUpdateJob.create({ host_id: monitor.host_id })
      next(null,result)
    })
  })
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
    //{ customer: customer, emitter: monitor, name: MONITORS.RESOURCE_NORMAL } ,
    Object.assign({}, base, { name: MONITORS.RESOURCE_RECOVERED }) ,
    Object.assign({}, base, { name: MONITORS.RESOURCE_STOPPED }) ,
    Object.assign({}, base, { name: MONITORS.RESOURCE_FAILURE }) ,
    (err) => {
      if (err) logger.error(err)
    }
  );

  if (monitor.type === MONITORS.RESOURCE_TYPE_FILE) {
    MonitorEvent.create({
      customer: customer,
      emitter: monitor,
      emitter_id: monitor._id,
      name: MONITORS.RESOURCE_CHANGED
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
  const updates = input.updates
  const resource = input.resource

  logger.log('updating monitor %j',updates);

  // remove cannot change from updates if present
  delete updates.monitor
  delete updates.customer
  delete updates.user_id
  delete updates.user

  // if model is changed just remove the template link
  updates.template = null
  updates.template_id = null

  resource.update(updates,(err) => {
    if (err) {
      logger.error(err)
      return next(err)
    }

    MonitorModel.findOne({
      resource_id: resource._id
    },function(error,monitor){
      if (error) {
        logger.error(err)
        return next(error)
      }
      if (!monitor) {
        return next(new Error('resource monitor not found'), null)
      }

      var previous_host_id = monitor.host_id
      var new_host_id
      if (updates.host_id) {
        new_host_id = updates.host_id.toString() // mongo ObjectID
      } else {
        new_host_id = monitor.host_id // current
      }

      monitor.update(updates,(err) => {
        if (err) {
          logger.error(err)
          return next(err)
        }

        AgentUpdateJob.create({ host_id: new_host_id })
        // if monitor host is changed, the new and the old agents should be notified
        if (new_host_id !== null && previous_host_id != new_host_id) {
          AgentUpdateJob.create({ host_id: previous_host_id })
        }

        Tag.create(updates.tags,{ _id: resource.customer_id })
        next(null,resource)
      })
    })
  })
}

function getEventSeverity (event,resource) {
  logger.log('resource event is "%s"', event);

  const hasSeverity = resource.failure_severity &&
    MONITORS.MONITOR_SEVERITIES.indexOf(
      resource.failure_severity.toUpperCase()
    ) !== -1

  // severity is set and is valid
  if (hasSeverity) return resource.failure_severity;

  // else try to determine the severity
  if (event && /^host:stats:.*$/.test(event)) {
    return 'LOW'
  } else {
    return 'HIGH'
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
    const fetched = after(resources.length,() => {
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

        if (!monitor) {
          logger.error('monitor for resource id %s was not found',resource._id)
          data.monitor = null
        } else {
          data.monitor = monitor.toObject()
        }

        pub.push(data)
        fetched()
      })
    })
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
    if (monitors.length !== 0) {
      var monitor = monitors[0]
      monitor.remove(function(err){
        if (err) {
          return logger.error(err)
        }

        MonitorEvent.remove({
          emitter_id: monitor._id
        }, (err) => {
          if (err) logger.error(err)
        })

        logger.log('monitor %s removed', monitor.name);
        if (notifyAgents) {
          AgentUpdateJob.create({ host_id: monitor.host_id });
        }
      })
    } else {
      logger.error('monitor not found.')
    }

    resource.remove(function(err){
      if (err) return done(err)
      done()
    })
  })
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

  var completed = after(hosts.length, function(){
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

  const generateResourceModel = (input) => {
    const data = assign({}, input, {
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
    delete data.id
    delete data._id
    logger.log('creating resource from template %j', data)
    return new ResourceModel(data)
  }

  const generateMonitorModel = (input) => {
    const data = assign({}, input.monitor_template, {
      host: host,
      host_id: host._id,
      template: template.monitor_template._id,
      template_id: template.monitor_template._id,
      customer: resource.customer_id,
      customer_id: resource.customer_id,
      customer_name: resource.customer_name,
      _type: 'ResourceMonitor'
    })
    // remove template _id
    delete data._id
    delete data.id
    logger.log('creating monitor from template %j', data)
    return new MonitorModel(data)
  }

  const input = template.toObject()
  input.monitor_template = template.monitor_template.toObject()

  //if (template.type === 'dstat') {
  //  input.name = 'Health'
  //  input.monitor_template.name = 'Health'
  //}
  //if (template.type === 'psaux') {
  //  input.name = 'Process List'
  //  input.monitor_template.name = 'Process List'
  //}

  var resource = generateResourceModel(input)
  var monitor = generateMonitorModel(input)

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
const handleHostIdAndData = (hostId, input, doneFn) => {
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
  })
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
    type: 'script',
    script: script._id
  }
  ResourceMonitorService.findBy(query, function (error, monitors) {
    if (!monitors||monitors.length==0) {
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
      logger.log('notifying host "%s"', host)
      AgentUpdateJob.create({ host_id: host })
    }
  })
}

Service.onScriptRemoved = function (script) {
  updateMonitorsWithDeletedScript(script);
}

Service.onScriptUpdated = function(script){
  notifyScriptMonitorsUpdate(script);
}

/**
 * if any job is assigned to the host's agent cancel it.
 */
const cancelAssignedJobsToHost = (host_id) => {
  const user = App.user // automatic job cancelation
  const filter = {
    where: {
      host_id: host_id
    }
  }

  // search for jobs to cancel
  logger.log('searching for jobs to cancel')
  App.jobDispatcher.fetchBy(filter, (err, jobs) => {
    if (err) return logger.error(err)

    if (jobs.length===0) {
      // nothing to do
      return
    }

    jobs
      .filter(job => job.lifecycle === Lifecycle.ASSIGNED)
      .forEach(job => App.jobDispatcher.cancel({ job, user }))
  })
}
