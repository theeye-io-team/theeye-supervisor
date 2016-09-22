"use strict";
const format = require('util').format;
const debug = require('debug')('eye:supervisor:service:resource:email-notifications');
const Constants = require('../../constants/monitors');
const ResourceTypes = {
  'dstat': {
    type: 'dstat',
    events:[{
      severity: 'LOW',
      name: 'host:stats:cpu:high',
      message: function(resource, event_data) { return `${resource.hostname} cpu check failed. ${event_data.cpu}% CPU in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} CPU alert`; }
    },{
      severity: 'LOW',
      name: 'host:stats:mem:high',
      message: function(resource, event_data) { return `${resource.hostname} mem check failed. ${event_data.mem}% MEM in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} MEM alert`; }
    },{
      severity: 'LOW',
      name: 'host:stats:cache:high',
      message: function(resource, event_data) { return `${resource.hostname} cache check failed. ${event_data.cache}% CACHE in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} CACHE alert`; }
    },{
      severity: 'LOW',
      name: 'host:stats:disk:high',
      message: function(resource, event_data) { return `${resource.hostname} disks check failed.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} DISK alert`; }
    },{
      severity:'LOW',
      name:'host:stats:normal',
      message: function(resource, event_data) { return `${resource.hostname} stats recovered.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} STATS recovered`; }
    }]
  },
  'psaux': {
    type: 'psaux',
    events: []
  },
  'host': {
    type: 'host',
    events: []
  },
  'process': {
    type: 'process',
    events: []
  },
  'script': {
    type: 'script',
    events: []
  },
  'scraper': {
    type: 'scraper',
    events: []
  },
  'service': {
    type: 'service',
    events: []
  }
};

module.exports = function(resource, event_name, event_data, done){
  var type = resource.type;
  try {
    var typeEvent = searchTypeEvent(type, event_name);
  } catch(error) {
    return done(error,null);
  }

  return done(null,{
    'content':typeEvent.message(resource, event_data),
    'subject':typeEvent.subject(resource, event_data)
  });
}

function searchTypeEvent(type,event_name)
{
  if( ! ResourceTypes.hasOwnProperty(type) ) {
    throw new Error('resource type "' + type + '" is invalid or not defined');
  }

  if(
    type == Constants.RESOURCE_TYPE_DSTAT ||
    type == Constants.RESOURCE_TYPE_PSAUX
  ){
    if(
      event_name == Constants.RESOURCE_STOPPED ||
      event_name == Constants.RESOURCE_RECOVERED ||
      ! event_name
    ) {
      throw new Error(type + '/' + event_name + ' event ignored.');
    }
  }

  var resourceType = ResourceTypes[type];
  var typeEvents = resourceType.events;

  if( typeEvents.length !== 0 ) {
    for(var i=0; i<typeEvents.length; i++){
      var typeEvent = typeEvents[i];
      if(typeEvent.name == event_name) return typeEvent;
    }
  }

  return defaultTypeEvent(event_name);
}

/**
 *
 * Generic alerts defined for all resource events
 * except dstat/psaux
 *
 */
function defaultTypeEvent(event_name){
  var spec ;
  switch(event_name){
    case Constants.RESOURCE_FAILURE:
      spec = {
        message: (resource, event_data) => `${resource.hostname} ${resource.description} checks failed.`,
        subject: (resource, event_data) => `[HIGH] ${resource.description} failure`
      };
      break;
    case Constants.RESOURCE_NORMAL:
      spec = {
        message: (resource, event_data) => `${resource.hostname} ${resource.description} checks recovered.`,
        subject: (resource, event_data) => `[HIGH] ${resource.description} recovered`
      };
      break;
    case Constants.RESOURCE_RECOVERED:
      spec = {
        message: (resource, event_data) => `${resource.hostname} ${resource.description} start reporting updates again.` ,
        subject: (resource, event_data) => `[HIGH] ${resource.description} recovered`
      };
      break;
    case Constants.RESOURCE_STOPPED:
      spec = {
        message: (resource, event_data) => `${resource.hostname} ${resource.description} stopped reporting updates.` ,
        subject: (resource, event_data) => `[HIGH] ${resource.description} unreachable`
      };
      break;
    case Constants.AGENT_STOPPED:
      spec = {
        message: (resource, event_data) => `${resource.hostname} host agent stopped reporting updates.` ,
        subject: (resource, event_data) => `[HIGH] ${resource.hostname} unreachable`
      };
      break;
    default:
      spec = {
        message: (resource, event_data) => `${resource.hostname} ${resource.description} reported an unknown state "${event_name}".` ,
        subject: (resource, event_data) => `[HIGH] ${resource.description} error`
      };
      break;
  }
  return spec;
}
