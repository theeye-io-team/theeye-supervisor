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
 *
 */
HostService.remove = async (input) => {
  const { id, user } = input

  logger.log('removing host "%s"', id)

  // find and remove host
  const host = await App.Models.Host.Entity.findById(id)
  if (!host) {
    throw new Error(`Host ${id} not found`)
  }

  const host_id = host._id.toString()

  // find and remove saved cached host stats
  await HostStats.deleteMany({ host_id })

  logger.log('removing host resources')
  const resources = await App.Models.Resource.Entity.find({ host_id })
  const toRemove = []
  for (let resource of resources) {
    toRemove.push( App.Models.Resource.Entity.remove({ resource, user, notifyAgents: false }) )
  }
  await Promise.all(toRemove)

  // find and remove host jobs
  logger.log('removing host jobs')
  const jobs = await App.Models.Job.Job.deleteMany({ host_id })

  logger.log('removing host from groups')
  const groups = await HostGroup.find({ hosts: host_id })
  if (groups.length > 0) {
    for (let group of groups) {
      const idx = group.hosts.indexOf(host_id)
      group.hosts.splice(idx, 1)
      group.save()
    }
  }

  // find and remove host tasks
  logger.log('removing the host from the tasks')
  await App.Models.Task
    .Entity
    .updateMany({ host_id }, { host_id: null, host: null })

  await host.remove()
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
    // uniq. one of each
    const files = filesToConfigure.sort().filter((item, pos, ary) => {
      return !pos || item != ary[pos - 1];
    })

    for (let file_id of files) {
      const file = await File.findById(file_id)
      if (file) {
        const recipe = await new Promise((resolve, reject) => {
          App.file.getRecipe(file, (err, recipe) => {
            if (err) { reject(err) }
            else { resolve(recipe) }
          })
        })
        recipes.push(recipe)
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
 * @param {Function(Error,Object)} next
 */
HostService.register = (input, next) => {
  const { hostname, customer, user } = input

  logger.log('registering new host "%s"', hostname)

  Host.create({
    customer_name: customer.name,
    customer_id: customer._id,
    creation_date: new Date(),
    last_update: new Date(),
    hostname
  }).then(host => {
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

    App.resource.create(data).then( resource => {
      next(null, { host, resource })
    })
  }).catch(err => {
    logger.error(err)
    next(err)
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
