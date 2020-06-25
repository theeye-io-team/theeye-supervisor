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
module.exports = (specs) => {
  const resource = specs.resource
  const type = resource.type
  const event_name = specs.event_name // || resource.state
  const severity = specs.failure_severity

  let typeEvent
  typeEvent = searchTypeEvent(type, event_name)

  if (!typeEvent) {
    typeEvent = Object.create(defaultTypeEvent(event_name))
  }

  typeEvent.severity = severity ? severity.toUpperCase() : 'HIGH'

  let result = {
    body: typeEvent.message(resource, specs),
    subject: typeEvent.subject(resource, specs)
  }

  return result
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
    case Constants.RESOURCE_SUCCESS:
    case Constants.RESOURCE_NORMAL:
    case Constants.RESOURCE_RECOVERED:
      spec = {
        message: function(resource, event_data) {
          return `${resource.hostname||''} ${resource.name} is now ok.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} recovered`
        }
      };
      break;
    case Constants.RESOURCE_STOPPED:
      spec = {
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} stopped reporting.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} unreachable`
        }
      };
      break;
    case Constants.AGENT_STOPPED:
      spec = {
        message: function(resource, event_data) {
          return `${resource.hostname} host agent stopped reporting.`
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
          return `${resource.hostname||''} ${resource.name} checks failed.`
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
function searchTypeEvent (type, event_name) {
  var typeEvent = undefined;
  event_name || (event_name=null)

  if (!ResourceTypes.hasOwnProperty(type)) {
    throw new Error('resource type "' + type + '" is invalid or not defined');
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
