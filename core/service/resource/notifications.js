'use strict';

const format = require('util').format;
const debug = require('debug')('service:resource:notifications');
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
  'psaux': { type: 'psaux', events: [] },
  'host': { type: 'host', events: [] },
  'process': { type: 'process', events: [] },
  'script': { type: 'script', events: [] },
  'scraper': { type: 'scraper', events: [] },
  'service': { type: 'service', events: [] },
  'file': {
    type: 'file', 
    events: [{
      severity: 'LOW',
      name: 'monitor:file:changed',
      message: function(resource, event_data) { return `${resource.hostname} file stats has been changed or was not present in the filesystem. It was replaced with the saved version.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} file has changed`; }
    }]
  },
};

module.exports = function (specs, done) {
  var typeEvent ;
  var resource = specs.resource;
  var event_name = specs.event;
  var event_data = specs.data||{};
  var severity = specs.failure_severity;
  var type = resource.type;

  try {
    typeEvent = searchTypeEvent(type, event_name);
  } catch (error) {
    return done(error,null);
  }

  if (!typeEvent) {
    typeEvent = Object.create(defaultTypeEvent(specs.resource.state));
  }

  if (specs.failure_severity) {
    typeEvent.severity = specs.failure_severity.toUpperCase();
  }

  return done(null,{
    content: typeEvent.message(resource, event_data),
    subject: typeEvent.subject(resource, event_data)
  });
}

/**
 * @param String type
 * @param String event_name
 * @return {Object} {String severity, String message, String subject}
 */
function searchTypeEvent (type,event_name) {
  var typeEvent = undefined;

  if (!ResourceTypes.hasOwnProperty(type)) {
    throw new Error('resource type "' + type + '" is invalid or not defined');
  }

  if (
    type == Constants.RESOURCE_TYPE_DSTAT ||
    type == Constants.RESOURCE_TYPE_PSAUX
  ) {
    if (
      event_name === Constants.RESOURCE_STOPPED ||
      event_name === Constants.RESOURCE_RECOVERED ||
      !event_name
    ) {
      throw new Error(type + '/' + event_name + ' event ignored.');
    }
  }

  var resourceType = ResourceTypes[type];
  var typeEvents = resourceType.events;

  if (typeEvents.length !== 0) {
    for (var i=0; i<typeEvents.length; i++) {
      typeEvent = typeEvents[i];
      if (typeEvent.name == event_name) {
        return Object.create(typeEvent);
      }
    }
  }

  return typeEvent;
}

/**
 *
 * Generic alerts defined for all resource events
 * except dstat/psaux
 *
 */
function defaultTypeEvent (event_name) {
  var spec ;
  switch (event_name) {
    case Constants.RESOURCE_FAILURE:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} checks failed.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} failure`
        }
      };
      break;
    case Constants.RESOURCE_NORMAL:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} checks recovered.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} recovered`
        }
      };
      break;
    case Constants.RESOURCE_RECOVERED:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} start reporting updates again.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} recovered`
        }
      };
      break;
    case Constants.RESOURCE_STOPPED:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} stopped reporting updates.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} unreachable`
        }
      };
      break;
    case Constants.AGENT_STOPPED:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} host agent stopped reporting updates.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.hostname} unreachable`
        }
      };
      break;
    case Constants.WORKERS_ERROR_EVENT:
    default:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          var message, data = event_data;

          if (data.error) {
            if (typeof data.error === 'string') {
              message = data.error;
            } else if (typeof data.error.message === 'string') {
              message = data.error.message;
            }
          } else {
            message = event_name;
          }

          return `${resource.hostname} ${resource.name} reported an error "${message}".`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} error`
        }
      };
      break;
  }
  return spec;
}
