'use strict';

const format = require('util').format;
const debug = require('debug')('service:resource:notifications');
const Constants = require('../../constants/monitors');
const ResourceTypes = {
  dstat: {
    type: 'dstat',
    events:[{
      severity: 'LOW',
      name: 'host:stats:cpu:high',
      message: function(resource, event_data) { return `${resource.hostname} cpu check failed. ${Number(event_data.cpu).toFixed(2)}% CPU in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} CPU alert`; }
    },{
      severity: 'LOW',
      name: 'host:stats:mem:high',
      message: function(resource, event_data) { return `${resource.hostname} mem check failed. ${Number(event_data.mem).toFixed(2)}% MEM in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} MEM alert`; }
    },{
      severity: 'LOW',
      name: 'host:stats:cache:high',
      message: function(resource, event_data) { return `${resource.hostname} cache check failed. ${Number(event_data.cache).toFixed(2)}% CACHE in use`; },
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
  psaux: { type: 'psaux', events: [] },
  host: {
    type: 'host',
    events: [{
      severity: 'HIGH',
      name: Constants.RESOURCE_STOPPED,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.hostname} unreachable`
      },
			message: function(resource, event_data) {
        return `Host ${resource.hostname.toUpperCase()} stopped reporting updates.`
			}
    },{
      severity: 'HIGH',
      name: Constants.RESOURCE_RECOVERED,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.hostname} recovered`
      },
			message: function(resource, event_data) {
        return `Host ${resource.hostname.toUpperCase()} started reporting again.`
			}
    }]
  },
  process: { type: 'process', events: [] },
  scraper: { type: 'scraper', events: [] },
  service: { type: 'service', events: [] },
  script: {
    type: 'script',
    events: [{
      severity: 'HIGH',
      name: Constants.RESOURCE_FAILURE,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.name} failure`
      },
			message: function(resource, event_data) {
				let result
        // use an empty object if not set
        if (!resource.last_event||!resource.last_event.script_result) {
          result = {}
        } else {
          result = resource.last_event.script_result
        }

				const lastline = result.lastline ? result.lastline.trim() : 'no data'
				const stdout = result.stdout ? result.stdout.trim() : 'no data'
				const stderr = result.stderr ? result.stderr.trim() : 'no data'
				const code = result.code || 'no data'
				const html = `
					<p>${resource.name} on ${resource.hostname} checks failed.</p>
					<span>Monitor output</span>
					<pre>
						<ul>
							<li>lastline : ${lastline}</li>
							<li>stdout : ${stdout}</li>
							<li>stderr : ${stderr}</li>
							<li>code : ${code}</li>
						</ul>
					</pre>`

				return html
			}
    }]
  },
  file: {
    type: 'file', 
    events: [{
      severity: 'LOW',
      name: 'monitor:file:changed',
      message: function(resource, event_data) { return `${resource.hostname} file ${resource.monitor.config.path} stats has been changed or was not present in the filesystem. It was replaced with the saved version.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} file ${resource.monitor.config.basename} was restored`; }
    }]
  },
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
    case Constants.RESOURCE_FAILURE:
    default:
      spec = {
        severity: 'HIGH',
        message: function(resource, event_data) {
          return `${resource.hostname} ${resource.name} checks failed.`
        } ,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} failure`
        }
      }
      break
      //spec = {
      //  severity: 'HIGH',
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

/**
 *
 * @param {Object} specs
 * @param {Resource} specs.resource
 * @param {String} specs.event
 * @param {Object} specs.data
 * @param {String} specs.failure_severity
 */
module.exports = function (specs, done) {
  const resource = specs.resource
  const type = resource.type
  const event_name = specs.event || resource.state
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

  if (severity) {
    typeEvent.severity = severity.toUpperCase()
  }

  return done(null,{
    content: typeEvent.message(resource, event_data),
    subject: typeEvent.subject(resource, event_data)
  })
}
