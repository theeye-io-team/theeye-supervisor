'use strict'

const App = require('../../app')
const after = require('lodash/after')
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

HostService.provisioning = async (input) => {
  const { host, customer } = input
  await HostGroupService.orchestrate(host, customer)
  App.jobDispatcher.createAgentUpdateJob(host._id)
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
HostService.config = async (host, customer, next) => {
  const filesToConfigure = []

  const resourcesConfig = async () => {
    const recipes = []

    const resources = await Resource.find({
      //enable: true,
      host_id: host._id,
      customer_id: customer._id,
      type: { $ne: 'host' }
    })

    if (Array.isArray(resources) && resources.length > 0) {
      for (let resource of resources) {
        const resourceData = resource.templateProperties({backup:true})

        const monitor = await Monitor.findOne({ resource_id: resource._id })
        resourceData.monitor = monitor.templateProperties({backup:true})
        recipes.push(resourceData)

        if (monitor.type === MonitorsConstants.RESOURCE_TYPE_SCRIPT) {
          filesToConfigure.push(monitor.config.script_id.toString())
        } else if (monitor.type === MonitorsConstants.RESOURCE_TYPE_FILE) {
          filesToConfigure.push(monitor.config.file.toString())
        }
      }
    }

    return recipes
  }

  const tasksConfig = async () => {
    const recipes = []
    const tasks = await Task.find({
      //enable: true,
      host: host._id,
      customer_id: customer._id
    })

    if (Array.isArray(tasks) && tasks.length > 0) {
      for (let task of tasks) {
        if (task.type === TaskConstants.TYPE_SCRIPT && task.script_id) {
          filesToConfigure.push(task.script_id.toString())
        }

        const values = task.templateProperties({backup:true})
        if (task.triggers.length > 0) {
          values.triggers = task.triggers // keep it until triggers are exported
        }
        recipes.push(values)
      }
    }

    return recipes
  }

  const filesConfig = async () => {
    const recipes = []
    if (filesToConfigure.length===0) {
      return []
    }

    // this function alters `filesToConfigure` (array) content
    const files = filesToConfigure.sort().filter((item, pos, ary) => {
      return !pos || item != ary[pos - 1];
    })

    for (let file_id of files) {
      const file = await File.findById(file_id)
      if (file) {
        const fileContent = await new Promise((resolve, reject) => {
          FileHandler.getBuffer(file, (err, buff) => {
            if (err) reject(err)
            else resolve(buff.toString('base64'))
          })
        })

        const props = file.templateProperties({backup:true}) // convert to plain object ...
        props.data = fileContent
        recipes.push(props)
      }
    }

    return recipes
  }

  const triggersConfig = async (tasks) => {
    const recipes = []

    logger.log('processing triggers')
    logger.data('triggers %j', tasks.triggers)

    for (let task of tasks) {
      if (Array.isArray(task.triggers) && task.triggers.length > 0) {
        const events = await fetchTaskTriggers(task.triggers)
        const triggers = await detectTaskTriggersOfSameHost(events, host)

        if (triggers.length > 0) {
          for (let trigger of triggers) {
            recipes.push({
              event_type: trigger._type,
              event_name: trigger.name,
              emitter_id: trigger.emitter_id,
              //emitter: trigger.emitter,
              task_id: task.source_model_id
            })

            // find trigger within task.triggers and remove
            let index
            const elem = task.triggers.find((t,idx) => {
              index = idx
              return t._id.toString() === trigger.id.toString()
            })

            if (elem !== undefined) {
              task.triggers.splice(index, 1)
            }
          }
        }

        // At this point task.triggers should contain only triggers that :
        // 1. belongs to tasks and monitors of other hosts
        // 2. to webhooks 
        // 3. other external events and sources (not implemented yet)
        // Triggers of same host should be "templatized"
      }
    }
    return recipes
  }

  const data = {}

  logger.log('getting resources config')
  data.resources = await resourcesConfig()

  logger.log('getting tasks config')
  data.tasks = await tasksConfig()

  logger.log('getting triggers config')
  data.triggers = await triggersConfig(data.tasks)

  logger.log('getting files config')
  data.files = await filesConfig()

  return data
}


const fetchTaskTriggers = async (triggers) => {
  const events = await App.Models.Event.Event.find({ _id: { $in: triggers } })
  if (Array.isArray(events) && events.length > 0) {
    // call after task events async populate is completed
    for (let event of events) {
      if (event) {
        await event.populate({
          path: 'emitter',
          populate: {
            path: 'host',
            model: 'Host'
          }
        }).execPopulate()
      }
    }
  }
  return events
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
 *
 * Given an task, extract the triggers for monitors and tasks that belongs
 * to the same host of the task.
 *
 * A trigger belongs to a host, if the monitor or task that emit
 * the event belongs to the same host.
 *
 * @param {Event[]} triggers array of task triggers, Event entities
 * @param {Host} host
 * @return {Promise<Array>}
 *
 */
const detectTaskTriggersOfSameHost = async (triggers, host) => {
  // pre-filter triggers data. should has been previously populated
  // if not valid object, skip
  const filteredTriggers = triggers.filter(event => {
    return !(!event || !event._id)
  },[])

  if (filteredTriggers.length === 0) {
    return []
  }

  const data = []
  for (let trigger of filteredTriggers) {
    //const isHostTrigger = await isHostEvent(trigger._id, host._id)
    if (trigger.emitter.host_id === host._id.toString()) {
      data.push({
        id: trigger._id,
        _type: trigger._type,
        name: trigger.name,
        emitter_id: trigger.emitter._id,
        //emitter: { // required by mongoose to populate schema
        //  _id: trigger.emitter._id,
        //  _type: trigger.emitter._type,
        //  name: trigger.emitter.name,
        //}
      })
    }
  }

  return data
}
