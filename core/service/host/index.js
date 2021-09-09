'use strict'

const App = require('../../app')
const after = require('lodash/after')
const async = require('async')
const logger = require('../../lib/logger')('service:host')
const FileHandler = require('../../lib/file')
const HostGroupService = require('./group')
const Constants = require('../../constants')
const MonitorsConstants = require('../../constants/monitors')
const TaskConstants = require('../../constants/task')

const File = require('../../entity/file').File
const Monitor = require('../../entity/monitor').Entity
const Event = require('../../entity/event').Event
const Host = require('../../entity/host').Entity
const HostGroup = require('../../entity/host/group').Entity
const HostStats = require('../../entity/host/stats').Entity
const Task = require('../../entity/task').Entity
const Resource = require('../../entity/resource').Entity
const JobModel = require('../../entity/job').Job
const AgentUpdateJob = require('../../entity/job').AgentUpdate

const HostService = {}

module.exports = HostService 

/**
 *
 * @param {Array<Host>} hosts
 * @param {Function}
 *
 */
HostService.populate = (hosts, next) => {
  let done = after(hosts.length, next)

  hosts.forEach(host => {
    host.populate('last_job', (err, h) => {
      if (err) logger.error('%o',err)
      done()
    })
  })
}

HostService.provision = (input) => {
  const { host, customer, user, resource, skip_auto_provisioning } = input
  const host_id = host._id

  HostGroupService.orchestrate(host, (err, groups) => {
    if (err) {
      logger.error(err)
      return
    }

    if (!groups || ! Array.isArray(groups) || groups.length === 0) {
      // create resources and notify agent
      //const monitorData = {
      //  user,
      //  customer,
      //  customer_id: customer._id,
      //  customer_name: customer.name,
      //  host,
      //  host_id: host._id.toString(),
      //  hostname: host.hostname,
      //  resource,
      //  enable: true,
      //  description: 'Host auto-created monitor.'
      //}

      // by default add base monitors always.
      if (skip_auto_provisioning === true) { return }
    }

    App.jobDispatcher.createAgentUpdateJob(host_id)
  })
}

/**
 *
 * @author Facundo
 * @param {Object} input
 * @property {Resource} input.resource the resource to be removed
 * @property {User} input.user requesting user
 * @param {Function(Error)} done
 *
 */
HostService.removeHostResource = function (input, done) {
  const resource = input.resource
  const user = input.user
  const host_id = resource.host_id

  logger.log('removing host "%s" resource "%s"', host_id, resource._id)

  // find and remove host
  logger.log('removing host')
  Host
    .findById(host_id)
    .exec(function(err, item){
      if (err) {
        logger.error(err)
        return
      }
      if (!item) return
      item.remove((err) => {
        if (err) logger.error(err)
      })
    })

  logger.log('removing host stats')
  // find and remove saved cached host stats
  HostStats
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove resources
  const removeResource = (resource, done) => {
    App.resource.remove({
      resource: resource,
      notifyAgents: false,
      user: user
    },(err) => {
      if (err) {
        logger.error(err)
        return
      }
      //else logger.log('resource "%s" removed', resource.name)
      done(err)
    });
  }

  logger.log('removing host resources')
  Resource
    .find({ host_id: host_id })
    .exec(function(err, resources){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(resources)||resources.length===0) return
      const resourceRemoved = after(resources.length, () => {
        // all resources && monitors removed
      })

      for (var i=0; i<resources.length; i++) {
        removeResource(resources[i], resourceRemoved)
      }
    })

  // find and remove host jobs
  logger.log('removing host jobs')
  JobModel
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(items)||items.length===0) return
      for (var i=0; i<items.length; i++) {
        items[i].remove((err) => {})
      }
    })

  // find and remove host tasks
  logger.log('removing the host from the tasks')
  Task
    .find({ host_id: host_id })
    .exec(function(err, items){
      if (err) {
        logger.error(err)
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

  logger.log('removing host from groups')
  HostGroup
    .find({ hosts: host_id })
    .exec((err,groups) => {
      if (err) {
        logger.error(err)
        return
      }
      if (!Array.isArray(groups) || groups.length===0) return
      for (var i=0; i<groups.length; i++) {
        removeFromGroup(groups[i])
      }
    })
}

/**
 * return host tasks (including triggers) & monitors configuration
 *
 * @param {Host} host
 * @param {Function} next
 */
HostService.config = (host, customer, next) => {
  const data = { resources: [], tasks: [], triggers: [], files: [] }
  const filesToConfigure = []

  const resourcesConfig = (done) => {
    Resource.find({
      enable: true,
      host_id: host._id,
      customer_id: customer._id,
      type: { $ne: 'host' }
    }).exec(function(err,resources){
      if (err) return done()
      if (!resources||resources.length===0) return done()

      const completed = after(resources.length, done)

      resources.forEach(resource => {
        let resourceData = resource.templateProperties()
        resourceData.last_event = null

        Monitor.findOne({
          resource_id: resource._id
        }).exec(function(err,monitor){
          resourceData.monitor = monitor.templateProperties()
          data.resources.push(resourceData)

          if (monitor.type === MonitorsConstants.RESOURCE_TYPE_SCRIPT) {
            filesToConfigure.push(monitor.config.script_id.toString())
          } else if (monitor.type === MonitorsConstants.RESOURCE_TYPE_FILE) {
            filesToConfigure.push(monitor.config.file.toString())
          }

          completed()
        })
      })
    })
  }

  const tasksConfig = (done) => {
    Task.find({
      enable: true,
      host: host._id,
      customer_id: customer._id
    }).exec(function(err,tasks){
      if (err) return done()
      if (!tasks||tasks.length===0) return done()

      const completed = after(tasks.length, done)

      tasks.forEach(task => {
        if (task.type === TaskConstants.TYPE_SCRIPT && task.script_id) {
          filesToConfigure.push(task.script_id.toString())
        }

        task.populateTriggers(() => {
          logger.log('processing triggers')
          logger.data('triggers %j', task.triggers)

          data.tasks.push(task.templateProperties())

          if (
            ! task.triggers ||
            ! Array.isArray(task.triggers) ||
            task.triggers.length===0
          ) {
            // if no triggers
            return completed()
          }

          detectTaskTriggersOfSameHost(task.triggers, host, (err,triggers) => {
            if (!err && triggers.length>0) {
              data.triggers.push({
                task: {
                  _id: task._id,
                  _type: task._type,
                  name: task.name,
                },
                task_id: task._id,
                events: triggers
              })

              // find trigger within task.triggers and remove
              triggers.forEach(trigger => {
                var index
                const elem = task.triggers.find((t,idx) => {
                  index = idx
                  return t._id === trigger.id 
                })

                if (elem !== undefined) {
                  task.triggers.splice(index, 1)
                }
              })
            }
            // At this point task.triggers should contain only triggers that :
            // 1. belongs to tasks and monitors of other hosts
            // 2. to webhooks 
            // 3. other external events and sources (not implemented yet)
            // Triggers of same host should be "templatized"
            completed()
          })
        })
      })
    })
  }

  const filesConfig = (done) => {
    if (filesToConfigure.length===0) { return done() }

    // this function alters `filesToConfigure` (array) content
    const unique = (() => {
      return filesToConfigure.sort().filter((item, pos, ary) => {
        return !pos || item != ary[pos - 1];
      })
    })()

    async.map(
      unique,
      (file_id, next) => {
        File.findById(file_id, (err, file) => {
          if (err) return next(err)
          if (!file) return next(null,file_id)

          FileHandler.getBuffer(file, (error, buff) => {
            let props = file.templateProperties() // convert to plain object ...
            if (error) {
              logger.error('error getting file buffer. %s', error)
              props.data = '' // cannot obtain file content
            } else {
              props.data = buff.toString('base64') // ... assign data to file plain object only
            }
            data.files.push(props)
            next(null, file)
          })
        })
      }, done
    )
  }

  logger.log('getting resources config')
  resourcesConfig(() => {
    logger.log('getting tasks config')
    tasksConfig(() => {
      logger.log('getting files config')
      filesConfig(() => {
        logger.log('data fetched')
        next(null,data)
      })
    })
  })
}

/**
 * @summary Register a new host
 * @author Facugon
 * @param {Object} input
 * @param {String} input.hostname
 * @param {Customer} input.customer
 * @param {User} input.user
 * @param {Object} input.info
 * @property {String} input.info.agent_version
 * @property {String} input.info.ip
 * @property {String} input.info.os_name
 * @property {String} input.info.os_version
 * @property {String} input.info.state
 * @param {Function(Error,Object)} next
 */
HostService.register = (input, next) => {
  const hostname = input.hostname
  const customer = input.customer
  const info = input.info
  const user = input.user

  logger.log('registering new host "%s"', hostname)

  Host.create({
    customer_name: customer.name,
    customer_id: customer._id,
    creation_date: new Date(),
    last_update: new Date(),
    hostname: hostname,
    ip: info.ip,
    os_name: info.os_name,
    os_version: info.os_version,
    agent_version: info.agent_version,
    state: info.state
  }, (err, host) => {
    if (err) {
      logger.error(err)
      return next(err)
    }

    logger.log('host registered. creating host resource')

    const data = {
      user,
      customer,
      customer_id: customer._id,
      customer_name: customer.name,
      host_id: host._id,
      hostname: host.hostname,
      name: host.hostname,
      type: 'host',
      monitor_type: 'host',
      enable: true,
      description: host.hostname
    }

    createHostResource(host, data, (err, payload) => {
      if (err) { return next(err) }
      logger.log('host %s resource created', hostname)
      next(null, payload)
    })
  })
}

/**
 * @deprecated
 */
HostService.fetchBy = (query,next) => {
  console.warn('DEPRECATE THIS. DO NOT USE AND REMOVE')

  logger.log('fetching hosts by customer %s',query.customer_name);

  Host.find(query,(err,hosts) => {
    if (err) {
      return next(err,null)
    }

    if (hosts.length===0) return next(null,[])

    logger.log('publishing hosts')
    var pub = []
    hosts.forEach((host,id) => {
      pub.push( host.publish() )
    })
    next(null,pub)
  })
}

HostService.disableHostsByCustomer = (customer, doneFn) => {
  Host 
  .find({ 'customer_id': customer._id })
  .exec(function(error, hosts){
    if(hosts.length != 0){
      for(var i=0; i<hosts.length; i++){
        var host = hosts[i];

        host.enable = false;
        host.save(function(error){
          if(error) {
            logger.error('ERROR updating host property');
            throw error;
          }
        });
      }
    }
  });
}

/**
 * Create a resource for the host
 *
 * @summary Create host resource
 * @param {Host} host
 * @param {Object} data
 * @property {Customer} data.customer
 * @property {Mixed} ... many more properties
 * @param {Function(Error,Object)} next
 */
const createHostResource = (host, data, next) => {
  const customer = data.customer

  App.resource.create(data, (err, result) => {
    if (err) {
      logger.error(err)
      return next(err)
    }

    logger.log('host resource created')
    const resource = result.resource
    next(null, { host, resource })
  })
}


/**
 * @summary create a dstats and psaux monitoring workers
 * @param {Object} input
 * @param {Function} next
 */
//const createBaseMonitors = (input, next) => {
//  logger.log('creating base monitors')
//  next||(next = ()=>{})
//
//  const dstat = Object.assign({}, input, {
//    type: 'dstat',
//    name: 'Health Monitor'
//  })
//
//  const psaux = Object.assign({}, input, {
//    type: 'psaux',
//    name: 'Processes Monitor'
//  })
//
//  App.resource.createResourceOnHosts([ input.host._id ], dstat, (err) => {
//    if (err) logger.error(err)
//    App.resource.createResourceOnHosts([ input.host._id ], psaux, (err) => {
//      if (err) logger.error(err)
//      next()
//    })
//  })
//}

/**
 *
 * Given an task, extract the triggers for monitors and tasks that belongs
 * to the same host of the task. Remove the triggers from the task
 *
 * A trigger belongs to a host, if the monitor or task that emit
 * the trigger belongs to the host.
 *
 * @param {Event[]} triggers array of task triggers, Event entities
 * @param {Host} host
 * @param {Function(Error,Array)} next
 * @return null
 *
 */
const detectTaskTriggersOfSameHost = (triggers, host, next) => {
  const asyncOps = []

  // pre-filter triggers data. should has been previously populated
  // if not valid object, skip
  const filteredTriggers = triggers.filter(event => {
    return !(!event || !event._id)
  },[])

  if (filteredTriggers.length === 0) {
    return next(null,[])
  }

  // now get those of the same host
  async.filterSeries(
    filteredTriggers,
    (trigger, done) => {
      isHostEvent(trigger._id, host._id, (err,result) => {
        // on error report and ignore
        if (err) return done(null, false)
        done(null, result)
      })
    },
    (err, hostTriggers) => {
      if (err) return next(err,[])

      if (!Array.isArray(hostTriggers)||hostTriggers.length===0) {
        return next(null,[])
      }
      const data = hostTriggers.map(trigger => {
        return {
          id: trigger._id,
          _type: trigger._type,
          name: trigger.name,
          emitter_id: trigger.emitter._id,
          emitter: { // required by mongoose to populate schema
            _id: trigger.emitter._id,
            _type: trigger.emitter._type,
            name: trigger.emitter.name,
          }
        }
      })
      next(err, data)
    }
  )
}

/**
 * Detect if an event has an emitter that triggers a task on the same host
 * @param {ObjectId} event_id Event mongodb id
 * @param {ObjectId} host_id Host mongodb id
 * @param {Function} next callback
 */
const isHostEvent = (event_id, host_id, next) => {
  logger.log('fetching event %s', event_id)

  // use fetch instead of findById because fetch also populate
  // the correct emitter
  Event.fetch({ _id: event_id }, (err,events) => {
    if (err) { return next(err) }
    if (!events) { return next(null, false) }
    if (!Array.isArray(events) || events.length===0) {
      return next(null, false)
    }

    const event = events[0]
    if (!event.emitter) {
      var err = new Error('the event doesn\'t has an emitter')
      err.event = event
      logger.error(err)
      next(err, false)
    } else {
      if (!event.emitter.host_id) { // webhooks, special tasks
        next(null,false)
      } else {
        // emitter.host_id and host_id are ObjectId's 
        next(null, Boolean(event.emitter.host_id.toString() === host_id.toString()))
      }
    }
  })
}
