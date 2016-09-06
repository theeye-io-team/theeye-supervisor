"use strict";

var util = require('util');
var events = require('events');
var logger = require('../../lib/logger')('eye:supervisor:service:resource');
var _ = require('lodash');

var elastic = require('../../lib/elastic');
var CustomerService = require('../customer');
var NotificationService = require('../notification');
var ResourceSchema = require('../../entity/resource');
var Resource = ResourceSchema.Entity;
var ResourceStats = require('../../entity/resource/stats').Entity;
var ResourceMonitorSchema = require('../../entity/monitor');
var MonitorEntity = ResourceMonitorSchema.Entity;
var ResourceMonitorService = require('./monitor');
var Host = require('../../entity/host').Entity;
var Task = require('../../entity/task').Entity;
var HostStats = require('../../entity/host/stats').Entity;
var Job = require('../../entity/job').Entity;
var Tag = require('../../entity/tag').Entity;
var ResourcesEmailNotifications = require('./email-notifications');
var globalconfig = require('config');

var filter = require('../../router/param-filter');
var validator = require('validator');

var Service = module.exports = function Service(resource) {
  this.resource = resource;
};

const Constants = require('./constants');

util.inherits(Service, events.EventEmitter);

function getCustomerConfig (customer_id, done) {
  CustomerService.getCustomerConfig(
    customer_id,
    (error,config) => {
      done(config);
    }
  );
}

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

function registerResourceCRUDOperation(customer,data) {
  var key = globalconfig.elasticsearch.keys.monitor.crud;
  elastic.submit(customer,key,data);
}

function sendResourceEmailAlert (resource,input) {
  ResourcesEmailNotifications(
    resource,
    input.event,
    input.data,
    (error,emailDetails) => {
      if(error) {
        if( /event ignored/.test(error.message) === false )
          logger.error(error);
        logger.log('alerts email not send');
        return;
      }

      logger.log('sending email alerts');
      CustomerService.getAlertEmails(
        resource.customer_name,
        (error,emails) => {
          NotificationService.sendEmailNotification({
            'to': emails.join(','),
            'customer_name': resource.customer_name,
            'subject': emailDetails.subject,
            'content': emailDetails.content
          });
        });
    }
  );
}


function handleFailureState (resource,input,config)
{
  var customer_name = resource.customer_name;
  var failure_threshold = config.fails_count_alert;
   
  var newState = 'failure';

  logger.log('resource "%s" check fails.', resource.name);

  function stateChangeFailureSNS () {
    NotificationService.sendSNSNotification({
      'state':'failure',
      'data':input,
      'message':'resource failure',
      'customer_name':resource.customer_name,
      'resource':resource.name,
      'id':resource.id,
      'hostname':resource.hostname,
      'type':'resource'
    },{
      'topic':'events',
      'subject':'resource_update'
    });
  }


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
    if(resource.fails_count >= failure_threshold) {
      logger.log('resource "%s" state failure', resource.name);
      var sev = getEventSeverity(input);
      resource.failure_severity = sev;
      input.severity = sev;

      logStateChange(resource,input);

      if(input.state != Resource.INITIAL_STATE){
        if(resource.alerts !== false){
          input.event||(input.event=input.state);
          sendResourceEmailAlert(resource,input);
        }
        stateChangeFailureSNS();
      }
      resource.last_event = input;
      resource.state = newState;
    }
  }
  resource.save();
}

function handleNormalState (resource,input,config)
{
  var failure_threshold = config.fails_count_alert;
  logger.log('resource "%s" "%s" state is normal', resource.type, resource.name);

  function stateChangeNormalSNS () {
    NotificationService.sendSNSNotification({
      'state':input.state,
      'message':input.message||'resource normal',
      'customer_name':resource.customer_name,
      'resource':resource.name,
      'id':resource.id,
      'hostname':resource.hostname
    },{
      'topic':'events',
      'subject':'resource_update'
    });
  }

  var isRecoveredFromFailure = Boolean(resource.state == Constants.RESOURCE_FAILURE);

  var resource = resource ;
  // failed at least once
  if(resource.fails_count != 0){
    if(resource.fails_count >= failure_threshold){
      logger.log('resource "%s" "%s" has been restored', resource.type, resource.name);
      input.severity = getEventSeverity(input);
      logStateChange(resource,input);
      if(resource.alerts!==false){

        if(isRecoveredFromFailure){
          input.event||(input.event=input.state);
        } else {
          // is recovered from "stop sending updates"
          input.event = Constants.RESOURCE_RECOVERED;
        }

        sendResourceEmailAlert(resource,input);
      }
      stateChangeNormalSNS();
    }
    resource.failure_severity = null;
    resource.state = input.state;
    resource.fails_count = 0;
    resource.save();
  }
}

function handleUpdatesStoppedState (resource,input,config)
{
  var newState = input.state;
  var failure_threshold = config.fails_count_alert;

  function stateChangeStoppedSNS () {
    NotificationService.sendSNSNotification({
      'state': newState,
      'message': 'updates stopped',
      'customer_name': resource.customer_name,
      'resource': resource.name,
      'id': resource.id,
      'hostname': resource.hostname,
      'type': 'resource'
    },{
      'topic': 'events',
      'subject': 'resource_update'
    });
  }

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
      resource.state = newState ;
      resource.failure_severity = input.severity = getEventSeverity(input);
      logStateChange(resource,input);

      if(resource.alerts!==false){
        input.event||(input.event=input.state); // state = agent or resource stopped
        sendResourceEmailAlert(resource,input);
      }

      stateChangeStoppedSNS();
    }
  }
  resource.save();
}

function filterStateEvent(state){
  function isSuccess(txt){
    var successTexts = ['success','ok','normal'];
    return successTexts.indexOf( txt.toLowerCase() ) != -1 ;
  }

  function isFailure(txt){
    var failureTexts = ['error','fail','failure'];
    return failureTexts.indexOf( txt.toLowerCase() ) != -1 ;
  }

  if( typeof state == 'string' && isSuccess(state) ) return Constants.RESOURCE_NORMAL;
  if( typeof state == 'string' && isFailure(state) ) return Constants.RESOURCE_FAILURE;
  return state;
}

Service.prototype.handleState = function(input,next) {
  next||(next=function(){});
  var resource = this.resource;

  var state = filterStateEvent(input.state);
  input.state = state;

  getCustomerConfig(
    resource.customer_id,
    (config) => {
      if(!config) throw new Error('config not found');
      switch(input.state) {
        case Constants.RESOURCE_NORMAL :
          input.last_update = Date.now();
          handleNormalState(resource,input,config);
          break;
        case Constants.AGENT_STOPPED :
        case Constants.RESOURCE_STOPPED :
          handleUpdatesStoppedState(resource,input,config);
          break;
        default:
        case Constants.RESOURCE_FAILURE :
          input.last_update = Date.now();
          handleFailureState(resource,input,config);
          break;
      }

      if(input.last_update)
        resource.last_update = input.last_update;
      if(input.last_check)
        resource.last_check = input.last_check;
      resource.save();
      next();
    }
  );
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
  var type = input.type||input.monitor_type;
  var resource_data = {
    'host_id':input.host_id,
    'hostname':input.hostname,
    'customer_id':input.customer_id,
    'customer_name':input.customer_name,
    'name':input.name,
    'type':type,
    'description':input.description
  };

  ResourceMonitorService.setMonitorData( type, input, function(error,monitor_data){
    if(error) return next(error);
    if(!monitor_data) {
      var e = new Error('invalid resource data');
      e.statusCode = 400;
      return next(e);
    }

    createResourceAndMonitor({
      resource_data: resource_data,
      monitor_data: monitor_data
    },function(error,result){
      var monitor = result.monitor;
      var resource = result.resource;
      logger.log('resource & monitor created');
      registerResourceCRUDOperation(
        monitor.customer_name,{
          'name':monitor.name,
          'type':resource.type,
          'customer_name':monitor.customer_name,
          'user_id':input.user.id,
          'user_email':input.user.email,
          'operation':'create'
        }
      );
      Tag.create(input.tags,input.customer);
      Job.createAgentConfigUpdate(monitor.host_id);
      next(null,result);
    });
  });
};

/**
 *
 * update entities
 *
 */
Service.update = function(input,next) {
  var updates = input.updates;
  var resource = input.resource;

  if(updates.host){
    updates.host_id = updates.host._id;
    updates.hostname = updates.host.hostname;
  }

  resource.patch(updates,function(error){
    if(error) return next(error);
    MonitorEntity.findOne({
      'resource_id': resource._id
    },function(error,monitor){
      if(error) return next(error);
      if(!monitor) return next(new Error('resource monitor not found'), null);

      var previous_host = monitor.host_id;
      monitor.update(updates,function(error){
        if(error) return next(error);

        registerResourceCRUDOperation(
          monitor.customer_name,{
            'name':monitor.name,
            'type':resource.type,
            'customer_name':monitor.customer_name,
            'user_id':input.user.id,
            'user_email':input.user.email,
            'operation':'update'
          }
        );
        Job.createAgentConfigUpdate(updates.host_id);
        // if monitor host changes, the new and the old agents should be notified
        if(previous_host != updates.host_id){
          Job.createAgentConfigUpdate(previous_host);
        }

        Tag.create(updates.tags,{ _id: resource.customer_id });
        var result = { resource: resource, monitor: monitor };
        next(null,result);
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
Service.fetchBy = function(input,next) {
  var query = { };
  query.enable = true;
  query.customer_id = input.customer._id;
  if( input.host ) query.host_id = input.host._id;
  if( input.type ) query.type = input.type;

  Resource
    .find(query)
    .sort({'fails_count':-1,'type':1})
    .exec(function(error,resources){
      if(error) {
        logger.log('unable to fetch resources from database');
        return next(error,null);
      }

      if(resources.length===0) return next(null,[]);

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
 *
 */
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

        logger.log('monitor %s removed', monitor.name);
        if(notifyAgents) {
          Job.createAgentConfigUpdate(monitor.host_id);
        }
      });
    } else logger.error('monitor not found.');

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
          resource.save((error) => {
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
      Job.createAgentConfigUpdate(monitor.host_id);
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
      Job.createAgentConfigUpdate(host);
    }
  });
}

Service.onScriptRemoved = function (script) {
  updateMonitorsWithDeletedScript(script);
}

Service.onScriptUpdated = function(script){
  notifyScriptMonitorsUpdate(script);
}
