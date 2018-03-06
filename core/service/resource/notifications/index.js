//const format = require('util').format;
//const debug = require('debug')('service:resource:notifications');
const ResourceTypes = require('./event-details')
const Constants = require('../../../constants/monitors');

/**
 *
 * @param {Object} specs
 * @param {Resource} specs.resource
 * @param {String} specs.event
 * @param {String} specs.event_name
 * @param {Object} specs.data
 * @param {String} specs.failure_severity
 */
module.exports = function (specs, done) {
  const resource = specs.resource
  const type = resource.type
  const event_name = specs.event_name // || resource.state
  const event_data = specs.data || {}
  const severity = specs.failure_severity
  var typeEvent

  try {
    typeEvent = searchTypeEvent(type, event_name)
  } catch (error) {
    return done(error,null)
  }

  if (!typeEvent) {
    typeEvent = Object.create(defaultTypeEvent(event_name))
  }

  typeEvent.severity = severity ? severity.toUpperCase() : 'HIGH'

  return done(null,{
    content: typeEvent.message(resource, event_data),
    subject: typeEvent.subject(resource, event_data)
  })
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
    case Constants.RESOURCE_NORMAL:
      spec = {
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
        message: function(resource, event_data) {
          return `${resource.hostname} host agent stopped reporting updates.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.hostname} unreachable`
        }
      };
      break;
    case Constants.WORKERS_ERROR_EVENT:
    case Constants.RESOURCE_FAILURE:
    default:
      spec = {
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} checks failed.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} failure`
        }
      }
      break
      //spec = {
      //  message: function(resource, event_data) {
      //    var message, data = event_data;

      //    if (data.error) {
      //      if (typeof data.error === 'string') {
      //        message = data.error;
      //      } else if (typeof data.error.message === 'string') {
      //        message = data.error.message;
      //      }
      //    } else {
      //      message = event_name;
      //    }

      //    return `${resource.hostname} ${resource.name} reported an error "${message}".`
      //  } ,
      //  subject: function(resource, event_data) {
      //    return `[${this.severity}] ${resource.name} error`
      //  }
      //};
      //break;
  }
  return spec;
}

/**
 * @summary search for an event named event_name
 * @param String type
 * @param String event_name
 * @return {Object} {String severity, String message, String subject}
 */
function searchTypeEvent (type,event_name) {
  var typeEvent = undefined;
  event_name || (event_name=null)

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

  var resourceType = ResourceTypes[type]
  var typeEvents = resourceType.events

  if (typeEvents.length !== 0) {
    for (var i=0; i<typeEvents.length; i++) {
      let element = typeEvents[i]
      if (element.name == event_name) {
        return Object.create(element)
      }
    }
  }

  return typeEvent
}
