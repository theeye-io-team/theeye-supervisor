"use strict";

var logger = require('../../lib/logger')('service:resource');
var _ = require('lodash');

var elastic = require('../../lib/elastic');
var CustomerService = require('../customer');
var NotificationService = require('../notification');
var ResourceMonitorService = require('./monitor');
var EventDispatcher = require('../events');

var Resource = require('../../entity/resource').Entity;
var MonitorEntity = require('../../entity/monitor').Entity;
var MonitorTemplate = require('../../entity/monitor/template').Entity;
var Host = require('../../entity/host').Entity;
var Task = require('../../entity/task').Entity;
var HostStats = require('../../entity/host/stats').Entity;
var Job = require('../../entity/job').Job;
var AgentUpdateJob = require('../../entity/job').AgentUpdate;
var Tag = require('../../entity/tag').Entity;
var MonitorEvent = require('../../entity/event').MonitorEvent;
var ResourcesNotifications = require('./notifications');
var globalconfig = require('config');

const Constants = require('../../constants/monitors');

function Service(resource) {
  var _resource = resource;

  function logStateChange (resource,input) {
    var data = {
      'date': (new Date()).toISOString(),
      'timestamp': (new Date()).getTime(),
      'state': input.state,
      'hostname': resource.hostname,
      'customer_name': resource.customer_name,
      'resource_id': resource._id,
      'resource_name': resource.name,
      'resource_type': resource.type,
      'type': 'resource-stats'
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

    ResourcesNotifications(
      resource,
      input.event,
      input.data,
      (error,emailDetails) => {
        if (error) {
          if ( /event ignored/.test(error.message) === false ) {
            logger.error(error);
          }
          logger.log('alerts email not send');
          return;
        }

        logger.log('sending email alerts');
        CustomerService.getAlertEmails(
          resource.customer_name,
          (error,emails) => {
            var mailTo, extraEmail=[];

            if ( Array.isArray(resource.acl) && resource.acl.length>0 ) {
              extraEmail = resource.acl.filter(email => emails.indexOf(email) === -1);
            }

            mailTo = (extraEmail.length>0) ? emails.concat(extraEmail) : emails;

            NotificationService.sendEmailNotification({
              'to': mailTo.join(','),
              'customer_name': resource.customer_name,
              'subject': emailDetails.subject,
              'content': emailDetails.content
            });
          }
        );
      }
    );
  }

  function dispatchResourceEvent (resource,eventName){
    MonitorEntity.findOne({
      resource_id: resource._id
    },function(err,monitor){
      if(!monitor){
        logger.error('resource monitor not found %j', resource);
        return;
      }

      logger.log('searching monitor %s event %s ', monitor.name, eventName);

      MonitorEvent.findOne({
        emitter: monitor._id,
        enable: true,
        name: eventName
      },function(err, event){
        if(err) return logger.error(err);
        else if(!event) return;

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
      resource.description, 
      resource._id,
      resource.fails_count,
      failure_threshold
    );

    // current resource state
    if(resource.state != newState) {
      // is it time to start sending failure alerts?
      if(resource.fails_count >= failure_threshold) {
        logger.log('resource "%s" state failure', resource.name);

        var sev = getEventSeverity(input);
        input.severity = sev;
        input.event||(input.event=input.state);

        resource.failure_severity = sev;
        resource.state = newState;

        sendResourceEmailAlert(resource,input);
        logStateChange(resource,input);
        dispatchResourceEvent(resource,newState);
        dispatchStateChangeSNS(resource,{
          message:'monitor failure',
          data:input
        });
      }
    }
  }

  function handleNormalState (resource,input,config) {
    logger.log('resource "%s" "%s" state is normal', resource.type, resource.name);

    var failure_threshold = config.fails_count_alert;
    var isRecoveredFromFailure = Boolean(resource.state==Constants.RESOURCE_FAILURE);

    resource.last_event = input;

    // failed at least once
    if (resource.fails_count!=0||resource.state!=Constants.RESOURCE_NORMAL) {
      resource.state = Constants.RESOURCE_NORMAL;

      logger.log('resource has failed');
      // resource failure was alerted ?
      if (resource.fails_count >= failure_threshold) {
        logger.log(
          'resource "%s" "%s" has been restored',
          resource.type,
          resource.name
        );

        input.severity = getEventSeverity(input);

        if (isRecoveredFromFailure) {
          input.event||(input.event=input.state);
        } else {
          // is recovered from "stop sending updates"
          input.event = Constants.RESOURCE_RECOVERED;
        }

        sendResourceEmailAlert(resource,input);
        logStateChange(resource,input);
        dispatchResourceEvent(resource,Constants.RESOURCE_RECOVERED);
        dispatchStateChangeSNS(resource,{
          message:(input.message||'monitor normal'),
          data:input
        });
        resource.failure_severity = null;
      }

      // reset state
      resource.fails_count = 0;
    }
  }

  function handleUpdatesStoppedState (resource,input,config) {
    var newState = input.state;
    var failure_threshold = config.fails_count_alert;

    resource.fails_count++;
    logger.log(
      'resource %s[%s] notifications stopped count %s/%s',
      resource.description,
      resource._id,
      resource.fails_count,
      failure_threshold
    );

    // current resource state
    if( resource.state != newState ) {
      if( resource.fails_count >= failure_threshold ) {
        logger.log('resource "%s" notifications stopped', resource.name);

        var sev = getEventSeverity(input);
        input.event||(input.event=input.state); // state = agent or resource stopped
        input.severity = sev;

        resource.state = newState;
        resource.failure_severity = sev;

        sendResourceEmailAlert(resource,input);
        logStateChange(resource,input);
        dispatchResourceEvent(resource,newState);
        dispatchStateChangeSNS(resource,{
          message:'updates stopped',
          data:input
        });
      }
    }
  }

  function isSuccess (state) {
    return Constants.SUCCESS_STATES
      .indexOf( state.toLowerCase() ) != -1 ;
  }
  function isFailure (state) {
    return Constants.FAILURE_STATES
      .indexOf( state.toLowerCase() ) != -1 ;
  }

  function filterStateEvent(state){
    if (typeof state == 'string' && isSuccess(state)) {
      return Constants.RESOURCE_NORMAL;
    }
    if (typeof state == 'string' && isFailure(state)) {
      return Constants.RESOURCE_FAILURE;
    }
    if (!state) {
      return Constants.RESOURCE_FAILURE;
    }
    return state;
  }


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

        switch(input.state) {
          // monitoring update event. detected stop
          case Constants.AGENT_STOPPED :
          case Constants.RESOURCE_STOPPED :
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

        resource.save( err => {
          if(err){
            logger.error('error saving resource %j', resource);
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


Service.findHostResources = function(host,options,done)
{
  var query = { 'host_id': host._id };
  if(options.type) query.type = options.type;
  Resource.find(query,(err,resources)=>{
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
 *
 */
Service.create = function (input, next) {
  next||(next=function(){});
  logger.log('creating resource for host %j', input);
  var type = (input.type||input.monitor_type);

  ResourceMonitorService.setMonitorData(type, input, function(error,monitor_data){
    if(error) return next(error);
    if(!monitor_data) {
      var e = new Error('invalid resource data');
      e.statusCode = 400;
      return next(e);
    }

    createResourceAndMonitor({
      resource_data: _.extend({},input,{
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
          user_id: input.user.id,
          user_email: input.user.email,
          operation: 'create'
        }
      );

      Service.createDefaultEvents(monitor,input.customer);
      Tag.create(input.tags,input.customer);
      AgentUpdateJob.create({ host_id: monitor.host_id });
      next(null,result);
    });
  });
};

Service.createDefaultEvents = function(monitor,customer,done){
  // CREATE DEFAULT EVENT
  MonitorEvent.create(
    // NORMAL state does not trigger EVENT
    //{ customer: customer, emitter: monitor, name: Constants.RESOURCE_NORMAL } ,
    { customer: customer, emitter: monitor, name: Constants.RESOURCE_RECOVERED } ,
    { customer: customer, emitter: monitor, name: Constants.RESOURCE_STOPPED } ,
    { customer: customer, emitter: monitor, name: Constants.RESOURCE_FAILURE } ,
    (err, result) => {
      if(err) logger.error(err);
      if(done) done(err, result);
    }
  );
}

/**
 *
 * update entities
 *
 */
Service.update = function(input,next) {
  var updates = input.updates;
  var resource = input.resource;

  if (updates.host) {
    updates.host_id = updates.host._id;
    updates.hostname = updates.host.hostname;
  }

  logger.log('updating monitor %j',updates);

  resource.update(updates,function(error){
    if (error) {
      logger.error(error);
      return next(error);
    }

    MonitorEntity.findOne({
      resource_id: resource._id
    },function(error,monitor){
      if(error) return next(error);
      if(!monitor) return next(new Error('resource monitor not found'), null);

      var previous_host_id = monitor.host_id;
      monitor.update(updates,function(error){
        if(error) return next(error);

        registerResourceCRUDOperation(
          monitor.customer_name,{
            name: monitor.name,
            type: resource.type,
            customer_name: monitor.customer_name,
            user_id: input.user.id,
            user_email: input.user.email,
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

function getEventSeverity (input) {
  var severity, event = input.event;
  logger.log('resource event is "%s"', event);
  if( event && /^host:stats:.*$/.test(event) ) {
    severity = 'LOW';
  } else {
    severity = 'HIGH';
  }
  return severity;
}

/**
 *
 * static methods
 *
 */
Service.fetchBy = function(filter,next) {
  var query = Resource.find( filter.where );
  if (filter.sort) query.sort( filter.sort );
  if (filter.limit) query.limit( filter.limit );

  query.exec(function(error,resources){
    if(error) {
      logger.error('unable to fetch resources from database');
      logger.error(error);
      return next(error,null);
    }

    if(resources===null||resources.length===0) return next(null,[]);

    var pub = [];
    var fetched = _.after(resources.length,() => next(null,pub));

    resources.forEach(resource => {
      resource.publish(function(error, data){
        MonitorEntity.findOne(
          { resource_id: resource._id },
          (error,monitor) => {
            data.monitor = monitor;
            pub.push(data); 
            fetched();
          }
        );
      });
    });
  });
}

/**
 *
 * @author Facundo
 *
 */
Service.removeHostResource = function (input,done) {
  var hid = input.resource.host_id;
  var rid = input.resource._id;

  logger.log('removing host "%s" resource "%s" resources', hid, rid);

  Host
    .findById(hid)
    .exec(function(err, item){
      if(err) return logger.error(err);
      if(!item) return;
      item.remove(function(err){
        if(err) logger.error(err);
      });
    });

  logger.log('removing host stats');
  HostStats
    .find({ host_id: hid })
    .exec(function(err, items){
      if(items && items.length != 0) {
        for(var i=0; i<items.length; i++){
          items[i].remove(function(err){ });
        }
      }
    }
  );

  function removeResource(resource, done){
    logger.log('removing host resource "%s"', resource.name);
    Service.remove({
      resource:resource,
      notifyAgents:false,
      user:input.user
    },function(err){
      if(err) return done(err);
      logger.log('resource "%s" removed', resource.name);
      done();
    });
  }

  Resource
    .find({ 'host_id': hid })
    .exec(function(err, resources){
      if(resources.length != 0){

        var doneResourceRemoval = _.after(resources.length, function(){
          // all resource & monitors removed
        });

        for(var i=0; i<resources.length; i++){
          var resource = resources[i];
          removeResource(resource, function(){
            doneResourceRemoval();
          });
        }
      }
    });

  logger.log('removing host jobs history');
  Job
    .find({ host_id: hid })
    .exec(function(err, items){
      if(items && items.length != 0) {
        for(var i=0; i<items.length; i++){
          items[i].remove(function(err){ });
        }
      }
    });

  Task
    .find({ host_id: hid })
    .exec(function(err, items){
      if(items && items.length != 0) {
        for(var i=0; i<items.length; i++){
          items[i].host_id = null;
          items[i].save();
        }
      }
    });
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

  MonitorEntity.find({
    'resource_id': resource._id
  },function(error,monitors){
    if(monitors.length !== 0){
      var monitor = monitors[0];
      monitor.remove(function(err){
        if(err) return logger.error(err);

        MonitorEvent.remove({ emitter: monitor._id }, err => logger.error(err));

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
  Resource
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
 *
 */
Service.createResourceOnHosts = function(hosts,input,doneFn)
{
  doneFn||(doneFn=function(){});
  logger.log('preparing to create resources');
  logger.log(input);
  var errors = null;
  var monitors = [];

  var completed = _.after(hosts.length, function(){
    logger.log('all hosts processed');
    doneFn(errors, monitors);
  });

  var hostProcessed = function(hostId, error, data){
    if(error){
      errors = errors || {};
      logger.log('there are some error %o', error);
      errors[ hostId ] = error.message;
    } else {
      logger.log('host resource and monitor created');
      monitors.push( data );
    }
    completed();
  }

  for(var i=0; i<hosts.length; i++) {
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
 * @param {Function} doneFn
 *
 */
Service.createMonitorFromTemplate = function(options) {
  var doneFn = ( options.done||(function(){}) ),
    template = options.template,
    host = options.host;

  MonitorTemplate.populate(template,{
    path: 'template_resource' 
  },function(err,monitorTemplate){
    var resourceTemplate = monitorTemplate.template_resource;
    var options = { 'host': host };
    Resource.FromTemplate(
      resourceTemplate,
      options,
      function(err,resource){
        if(err) {
          logger.log('Resorce creation error %s', err.message);
          return doneFn(err);
        }

        var props = _.extend( template, {
          host: options.host,
          host_id: options.host._id,
          resource: resource._id,
          resource_id: resource._id,
          template: monitorTemplate.id,
          id: null,
          customer_name: resource.customer_name,
          _type: 'ResourceMonitor'
        });

        logger.log('creating monitor from template');
        logger.data('monitor %j', props);
        var monitor = new MonitorEntity(props);
        monitor.save(function(err, instance){
          if(err) {
            logger.error(err.errors);
            logger.error(err);
            return doneFn(err);
          }

          Service.createDefaultEvents(monitor,resource.customer_id)

          doneFn(null,{
            'monitor': instance,
            'resource': resource
          });
        });
      }
    );
  });
}

/**
 *
 *
 * @author Facugon
 *
 */
function handleHostIdAndData(hostId, input, doneFn){
  Host.findById(hostId, function(err,host){
    if(err) return doneFn(err);

    if(!host) {
      var e = new Error('invalid host id ' + hostId);
      e.statusCode = 400;
      return doneFn(e);
    }

    input.host_id = host._id;
    input.hostname = host.hostname;

    Service.create(input, doneFn);
  });
}

/**
 *
 * create entities
 *
 */
function createResourceAndMonitor(input, done){
  var monitor_data = input.monitor_data;
  var resource_data = input.resource_data;

  logger.log('creating resource');
  Resource.create(resource_data, function(error,resource){
    if(error) throw error;
    else {
      logger.log('creating resource %s monitor', resource._id);
      logger.log(monitor_data);

      // monitor.resource is used to populate the entity. need refactor
      monitor_data.resource = resource._id;
      monitor_data.resource_id = resource._id;

      MonitorEntity.create(
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
function updateMonitorsWithDeletedScript (script,done)
{
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

function detachMonitorScript (monitor, done)
{
  done=done||function(){};
  if(!monitor.resource._id) {
    var err = new Error('populate monitor first. resource object required');
    logger.error(err);
    return done(err);
  }

  var resource = monitor.resource;
  resource.enable = false;
  resource.save(function(error){
    if(error) return logger.error(error);
    monitor.enable = false;
    monitor.config.script_id = null;
    monitor.config.script_arguments = [];
    monitor.save(function(error){
      if(error) return logger.error(error);
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
