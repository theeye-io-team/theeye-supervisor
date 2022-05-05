
const App = require('../../../app')
const after = require('lodash/after')
const config = require('config')
const logger = require('../../../lib/logger')('service:host:group')

/** TEMPLATES **/
const Event = require('../../../entity/event').Event
const Host = require('../../../entity/host').Entity
const HostGroup = require('../../../entity/host/group').Entity
const ResourceTemplate = require('../../../entity/resource/template').Entity
const MonitorTemplate = require('../../../entity/monitor/template').Entity
const TaskTemplate = require('../../../entity/task/template').Template
const Recipe = require('../../../entity/recipe').Recipe

/** NON TEMPLATES **/
const FileModel = require('../../../entity/file')
const Monitor = require('../../../entity/monitor').Entity
const Resource = require('../../../entity/resource').Entity
const Task = require('../../../entity/task').Entity
const ResourceTemplateService = require('../../../service/resource/template')

//exports.Monitor = require('./monitor')

const Service = module.exports = {
  /**
   * Remove all group template entities, and
   * unlink all the resources and tasks from the templates.
   * Also remove task and monitors events
   *
   * @author Facundo
   * @param {Object} input
   * @param {Function} done
   */
  remove (input, done) {
    const group = input.group
    const keepInstances = !input.deleteInstances

    group.populateAll((err) => {
      if (err) {
        logger.error('%o',err)
        return done(err)
      }

      const files = group.files.map(f => f._id)
      const tasks = group.tasks.map(t => t._id)
      const resources = group.resources.map(r => r._id)
      const monitors = group.resources.map(r => r.monitor_template_id)
      const hosts = group.hosts

      // remove in series
      logger.log('removing templated files')
      removeTemplateEntities(files, FileModel.Template.File, FileModel.File, keepInstances, () => {
        logger.log('removing templated tasks')
        removeTemplateEntities(tasks, TaskTemplate, Task, keepInstances, () => {
          logger.log('removing templated resources')
          removeTemplateEntities(resources, ResourceTemplate, Resource, keepInstances, () => {
            logger.log('removing templated monitors')
            removeTemplateEntities(monitors, MonitorTemplate, Monitor, keepInstances, () => {
              logger.log('all removed')
              if (hosts.length>0) {
                hosts.forEach(host => {
                  App.jobDispatcher.createAgentUpdateJob( host._id )
                })
              }
            })
          })
        })
      })

      group.remove((err) => {
        if (err) return done(err)
        done()
      })
    })
  },

  /**
   * @author Facugon
   * @summary create group definition.
   * @param {Object} input group data properties. freezed object
   * @property {Object[]} input.triggers plain objects array
   * @property {Object[]} input.tasks plain objects array
   * @property {Object[]} input.files plain objects array
   * @property {Object[]} input.resources plain objects array
   * @property {String[]} input.hosts array of hosts string ids
   * @property {Customer} input.customer
   * @property {User} input.user
   * @property {String} input.name
   * @property {String} input.description
   * @property {String} input.hostname_regex, a valid regular expression
   * @property {Boolean} input.applyToSourceHost
   */
  async create (input) {
    const triggers = input.triggers
    const tasks = input.tasks
    const files = input.files
    const resources = input.resources
    const customer = input.customer
    const user = input.user
    const applyToSourceHost = input.applyToSourceHost

    /**
     * @summary check if input.hosts contains the same id as source_host.
     * remove it if present. will be added at the end of the process
     * @param {String} host
     * @param {String[]} hosts
     * @return {String[]}
     */
      const findAndRemove = (host, hosts) => {
        let idx = hosts.indexOf(host)
        if (idx > -1) {
          hosts.splice(idx, 1) // remove host
        }
        return hosts
      }

    const values = Object.assign({}, input, {
      files: [],
      tasks: [],
      resources: [],
      user_id: user.id,
      customer_id: customer.id,
      customer_name: customer.name,
      hosts: findAndRemove(input.source_host, input.hosts.slice())
    })

    logger.log('creating group %o', values)
    // create host templates
    const group = await HostGroup.create(values)

    logger.log('creating recipe with provided data')
    await Recipe.create({
      tags: [],
      public: false,
      customer: customer._id,
      customer_id: customer._id,
      //user: user.id,
      user_id: user.id,
      name: group.name,
      description: group.description,
      instructions: { resources, tasks, triggers, files },
      hostgroup: group._id,
      hostgroup_id: group._id
    })

    const templates = await generateTemplates({
      group,
      tasks,
      resources,
      triggers,
      customer,
      user,
      files
    })

    logger.log('all templates created. attaching to group')
    // attach ids to template and save relations
    group.files = templates.files.map(f => f._id)
    group.triggers = templates.triggers
    group.resources = templates.resources.map(r => r._id)
    group.tasks = templates.tasks.map(t => t._id)
    await group.save()

    // host template has been created ! populate all the data
    await new Promise((resolve, reject) => {
      Service.populate(group, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    /**
     * copy template configs to the attached hosts.
     * group.hosts should be already populated,
     * it is Host object Array
     */
    if (group.hosts.length > 0) {
      logger.log('copying template to hosts')
      for (let i=0; i<group.hosts.length; i++) {
        const host = group.hosts[i]
        if (host._id.toString() !== input.source_host) {
          await copyTemplateToHost(host, group, customer)
        }
      }
    }

    if (input.source_host && applyToSourceHost === true) {
      await new Promise( (resolve, reject) => {
        addHostOriginToGroup(input.source_host, group, customer, user, err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    return group
  },

  /**
   * @author Facugon
   * @summary Replace host template basic properties. Will not affect tasks & monitors provisioning
   * @param {Object} input
   * @property {Customer} input.customer
   * @property {HostGroup} input.group
   * @property {String} input.name
   * @property {String} input.description
   * @property {String} input.hostname_regex a valid RegExp Pattern
   * @property {String[]} input.hosts valid ObjectId string array
   * @property {Object[]} input.tasks valid ObjectId string array
   * @property {Object[]} input.resources valid ObjectId string array
   * @property {Boolean} input.deleteInstances
   */
  async replace (input) {
    const { group, customer } = input
    const keepInstances = (!input.deleteInstances)

    if (!Array.isArray(group.hosts)) {
      group.hosts = [] // it must be
    }

    if (!Array.isArray(input.hosts)) {
      input.hosts = [] // it must be
    }

    // host elements only present in group.hosts.
    // group.hosts is an array of mongo ObjectID
    const delHosts = group.hosts.filter(idobj => input.hosts.indexOf(idobj.toString()) === -1)

    // host elements only present in input.hosts
    // input.hosts is an array of strings
    const newHosts = input.hosts.filter(idstr => group.hosts.indexOf(idstr) === -1)

    group.name = input.name
    group.hosts = input.hosts
    group.description = input.description
    group.hostname_regex = input.hostname_regex
    await group.save()

    await new Promise((resolve, reject) => {
      Service.populate(group, (err) => {
        if (err) { reject(err) }
        else { resolve() }
      })
    })

    if (newHosts.length > 0) {
      logger.log('copying template to hosts')
      for (let i=0; i < newHosts.length; i++) {
        const host = await Host.findById(newHosts[i])
        if (host) {
          await copyTemplateToHost(host, group, customer)
        }
      }
    }

    if (delHosts.length > 0) {
      for (let i=0; i < delHosts.length; i++) {
        const host = await Host.findById(delHosts[i])
        if (host) {
          unlinkHostFromTemplate(host, group, keepInstances)
            .catch(err => {
              logger.error('error unlinking templates')
            })
            .then(() => {
              App.jobDispatcher.createAgentUpdateJob( host._id )
            })
        }
      }
    }

    // updated version
    return group
  },

  /**
   * @author Facundo
   */
  populate (group, next) {
    next || (next = function(){})
    logger.log('publishing group')
    group.populateAll(err => {
      if (err) { return next(err) }
      App.resource.populateAll(group.resources, (err) => {
        if (err) { return next(err) }
        App.task.populateAll(group.tasks, (err) => {
          if (err) { return next(err) }
          next(null, group.toObject())
        })
      })
    })
  },


  /**
   *
   *
   *
   */
  async orchestrate (host, customer) {
    const groups = await searchGroupsForHost(host)

    if (!groups||groups.length===0) {
      return null
    }

    // copy each matching template
    for (let idx=0; idx<groups.length; idx++) {
      const group = groups[idx]
      logger.log('using group regexp %s', group.hostname_regex)
      //await supplyHostWithTemplateInstructions(host, group, customer)
      await new Promise((resolve, reject) => {
        Service.populate(group, (err) => {
          if (err) { return reject(err) }
          copyTemplateToHost(host, group, customer)
            .catch(reject)
            .then(resolve)
        })
      })

      group.hosts.addToSet(host._id)
      await group.save()

      logger.log('group %s provisioning completed', group.hostname_regex)
    }

    return
  }
}

/**
 *
 * @summary remove host task & resources and add to the template
 * @param {String} host_id
 * @param {HostGroup} group
 * @param {Customer} customer
 * @param {User} user
 * @param {Function(Error)} next
 */
const addHostOriginToGroup = (host_id, group, customer, user, next) => {
  next || (next=()=>{})

  /**
   * @summary find and remove tasks
   */
  const removeHostTasks = (host, next) => {
    const removeTask = (task, done) => {
      App.task.remove({
        customer: customer,
        user: user,
        task: task,
        fail: (err) => {
          logger.error('fail removing task %s', task._id)
          logger.error(err)
          done(err)
        },
        done: done
      })
    }
    // find and remove host tasks
    logger.log('removing host tasks')
    // find tasks not being part of a template and remove them.
    Task
      .find({
        $or: [
          { template: { $exists: false } }, // not exists
          { template: { $eq: null } } // not defined
        ],
        host_id: host_id,
      })
      .exec((err, tasks) => {
        if (err) {
          logger.error(err)
          return next(err)
        }
        if (!Array.isArray(tasks)||tasks.length===0) {
          return next()
        }
        // all resources && monitors removed
        const taskRemoved = after(tasks.length, next)

        for (var i=0; i<tasks.length; i++) {
          removeTask(tasks[i], taskRemoved)
        }
      })
  }

  /**
   * @summary find and remove resources which are not template.
   */
  const removeHostResources = (host, next) => {
    const removeResource = (resource, done) => {
      App.resource.remove({
        resource: resource,
        notifyAgents: false,
        user: user
      },(err) => {
        if (err) {
          logger.error(err)
          return done(err)
        }
        //else logger.log('resource "%s" removed', resource.name)
        done()
      })
    }

    logger.log('removing host resources')
    // find resources not being part of a template and remove them
    Resource
      .find({
        $or: [
          { template: { $exists: false } }, // not exists
          { template: { $eq: null } } // not defined
        ],
        host_id: host_id,
        type: { $ne: 'host' } // do not remove host type resources !!
      })
      .exec(function(err, resources){
        if (err) {
          logger.error(err)
          return next(err)
        }
        if (!Array.isArray(resources)||resources.length===0) {
          return next()
        }
        // all resources && monitors removed
        const resourceRemoved = after(resources.length, next)

        for (var i=0; i<resources.length; i++) {
          removeResource(resources[i], resourceRemoved)
        }
      })
  }

  /**
   * @summary clean up the host. remove tasks and resources
   */
  findHost(host_id, (err,host) => {
    if (err||!host) return next(err)
    removeHostTasks(host, (err) => {
      if (err) return next(err)
      removeHostResources(host, async (err) => {
        if (err) return next(err)
        copyTemplateToHost(host, group, customer).catch(next).then(() => {
          logger.log('adding original host to the template')
          group.hosts.addToSet(host._id)
          group.save(err => logger.error(err))
          return next()
        })
      })
    })
  })
}

/**
 *
 * @param {Object} input
 * @property {HostGroup} input.group
 * @property {Object[]} input.tasks tasks definitions/properties
 * @property {Object[]} input.files files definitions. each object contains a file content and metadata, and the linked model to the file
 * @property {Object[]} input.resources resources & monitors definitions/properties
 * @property {Object[]} input.triggers task event triggers. each object contains a task id and events from tasks and monitors on the same host
 * @property {Customer} input.customer
 * @property {User} input.user
 * @param {Function} done, callback
 *
 */
const generateTemplates = async (input) => {
  logger.log('creating host templates')

  const { group, customer, user, files } = input
  const templates = {}

  templates.files = await App.file.createTemplates({ group, files })

  const { tasks, resources } = remapDataToFilesTemplates(input, templates.files)

  templates.tasks = await App.task.createTemplates(group, tasks, customer, user)

  templates.resources = await ResourceTemplateService.createTemplates(
    group, resources, customer, user
  )

  templates.triggers = generateTasksTriggersTemplates(templates, input.triggers)

  return templates
}

/*
 * use the template refereces.
 */
const remapDataToFilesTemplates = (inputData, fileTemplates) => {
  const { tasks, resources } = inputData
  for (let fdx = 0; fdx < fileTemplates.length; fdx++) {
    const file = fileTemplates[fdx]
    if (file.source_model_id) {
      for (let rdx = 0; rdx < resources.length; rdx++) {
        const monitor = resources[rdx].monitor
        const data = Object.assign({}, monitor, monitor.config||{})
        if (
          data.file === file.source_model_id.toString() ||
          data.script_id === file.source_model_id.toString()
        ) {
          if (data.type === 'file') {
            data.file = file._id.toString()
          } else if (data.type === 'script') {
            data.script_id = file._id.toString()
          }
          resources[rdx].monitor = data
        }
      }

      for (let tdx = 0; tdx < tasks.length; tdx++) {
        const task = tasks[tdx]
        if (task.type === 'script') {
          if (task.script_id) {
            if (task.script_id.toString() === file.source_model_id.toString()) {
              task.script = file._id.toString()
              task.script_id = file._id.toString()
            }
          }
        }
      }
    }
  }
  return { tasks, resources }
}

/**
 *
 * the templates are linked to its source model, when available.
 * (source_model_id is available when the template was generated from another model)
 *
 * source_model_id is used to match the trigger of the original task to
 * the task template and register triggers relations within the host template.
 * This enables the template to recreate tasks and monitors relations at the
 * moment of host registration.
 *
 * @param {Object} templates
 * @property {TaskTemplate[]} templates.tasks
 * @property {ResourceTemplate[]} templates.resources, templates.resources[].monitor_template should be populated here
 * @param {Object[]} triggers
 *
 */
const generateTasksTriggersTemplates = (templates, triggers) => {
  logger.log('binding triggers to task templates')
  const { resources, tasks } = templates
  const eventTemplates = []

  if (!Array.isArray(tasks) || tasks.length===0) {
    return []
  }
  if (!Array.isArray(triggers) || triggers.length===0) {
    return []
  }

  for (let i = 0; i < triggers.length; i++) {
    const { task_id, event_type, event_name, emitter_id } = triggers[i]

    // search task for this triggers
    const taskTemplate = tasks.find(task => {
      return task.source_model_id && (
        task_id === task.source_model_id.toString()
      )
    })

    if (taskTemplate?._id) {
      // search the template via it's original emitter (task/monitor)
      if (event_type === 'TaskEvent') {
        // task templates emitter
        for (var k = 0; k < tasks.length; k++) {
          const source_id = tasks[k].source_model_id.toString()
          if (source_id === emitter_id) {
            eventTemplates.push({
              event_type, // the instance of Event to create
              event_name, // something to distinguish the event
              emitter_id: tasks[k]._id, // emitter task template id
              emitter_type: tasks[k]._type,
              task_id: taskTemplate._id, // triggered task template id
              task: taskTemplate._id, // triggered task template id
            })
          }
        }
      } else if (event_type === 'MonitorEvent') {
        // monitor templates emitter
        for (let l = 0; l < resources.length; l++) {
          const source_id = resources[l].monitor_template.source_model_id.toString()
          if (source_id === emitter_id) {
            eventTemplates.push({
              event_type, // the instance of Event to create
              event_name, // something to distinguish the event
              emitter_id: resources[l].monitor_template._id, // emitter monitor template id
              emitter_type: resources[l].monitor_template._type,
              task_id: taskTemplate._id, // triggered task template id
              task: taskTemplate._id, // triggered task template id
            })
          }
        }
      } else {
        // unexpected templates emitter
        logger.error('emitter type %s won\'t be registered',event_type)
      }
    }
  }

  if (eventTemplates.length===0) {
    logger.log('no triggers to bind.')
  } else {
    logger.log('triggers binding completed')
  }

  return eventTemplates
}

const findHost = (id, next) => {
  Host.findById(id, (err,host) => {
    if (err) {
      logger.error(err)
      return next(err)
    }
    if (!host) {
      const err = new Error('host not found')
      err.host = id
      logger.error(err)
      return next(err)
    }
    next(null,host)
  })
}

/**
 * Given a host, remove all the task and monitor copied from the template
 *
 * @author Facugon
 * @param {Host} host
 * @param {HostGroup} template
 * @param {Boolean} keepInstances
 * @param {Function} next
 */
const unlinkHostFromTemplate = async (host, template, keepInstances) => {
  /**
   * In all cases :
   * host_id (old property) is a mongo db string id.
   * template_id (new property) is a native ObjectID mongo type
   *
   * @summary Remove all Schema intances cloned from the template
   * @param {Mongoose.Schema} Schema
   * @param {Object} entityTemplate
   * @param {Boolean} keepInstances
   * @param {Function} done
   */
  const removeSchemaTemplatedInstances = async (Schema, template_id) => {
    const entities = await Schema.find({
      host_id: host._id.toString(),
      template_id: template_id
    })

    if (!entities||entities.length===0) { return }

    const promises = []
    for (let i=0; i<entities.length; i++) {
      if (keepInstances === true) {
        promises.push( updateEntity(entities[i]) )
      } else {
        promises.push( removeEntity(entities[i]) )
      }
    }
    return Promise.all(promises)
  }

  const updateEntity = (entity) => {
    entity.template = null
    entity.template_id = null
    entity.last_update = new Date()
    return entity.save()
  }

  const removeEntity = async (entity) => {
    await entity.remove()
    logger.log('entity %s removed', entity._type)
    // remove all events attached to the entity
    await Event.deleteMany({ emitter_id: entity._id })
    logger.log('events removed')
  }

  const taskPromises = []
  for (let taskTemplate of template.tasks) {
    taskPromises.push(
      removeSchemaTemplatedInstances(Task, taskTemplate._id)
    )
  }
  await Promise.all(taskPromises)

  const resourcePromises = []
  for (let resourceTemplate of template.resources) {
    resourcePromises.push(
      removeSchemaTemplatedInstances(
        Resource,
        resourceTemplate._id
      )
    )

    // remove linked monitor
    resourcePromises.push(
      removeSchemaTemplatedInstances(
        Monitor,
        resourceTemplate.monitor_template_id
      )
    )
  }
  await Promise.all(resourcePromises)
}

/**
 * @author Facugon
 * @summary copy all template properties to the given host
 * @param {Host} host
 * @param {HostGroup} template
 * @param {Customer} customer
 * @param {Function} next
 */
const copyTemplateToHost = async (host, template, customer) => {
  const filesMap = await createFilesMapFromTemplates(customer, template.files)
  const tasks = await copyTasksToHost(host, filesMap, template.tasks, customer)
  const resources = await copyResourcesToHost(host, filesMap, template.resources, customer)
  await copyTriggersToHostTasks(host, tasks, resources, template.triggers)
  logger.log('All entities processed')
  App.jobDispatcher.createAgentUpdateJob( host._id )
  return
}

const createFilesMapFromTemplates = (customer, filesTemplates) => {
  const locateFile = async (fileTemplate) => {
    const fileMap = (file) => {
      return {
        _id: file._id,
        template_id: fileTemplate._id,
        source_model_id: fileTemplate.source_model_id
      }
    }
    file = await FileModel.File.findOne({
      customer_id: customer._id.toString(),
      _id: fileTemplate.source_model_id // the original file is in this organization
    })

    // original file found
    if (file) {
      return fileMap(file)
    }

    file = await FileModel.File.findOne({
      customer_id: customer._id.toString(),
      template_id: fileTemplate._id // a file was created out of this file template
    })

    if (file) {
      return fileMap(file)
    }

    logger.log('not found. creating the file from template')

    // create a new file instance
    file = await new Promise((resolve, reject) => {
      App.file.createFromTemplate(
        { template: fileTemplate, customer },
        (err, file) => {
          if (err) reject(err)
          else resolve(file)
        }
      )
    })

    return fileMap(file)
  }

  const filesPromises = []
  for (let index = 0; index < filesTemplates.length; index++) {
    const fileTemplate = filesTemplates[index]
    filesPromises.push( locateFile(fileTemplate) )
  }
  return Promise.all(filesPromises)
}

const getFile = (file_id, filesMap) => {
  const file = filesMap.find(fm => {
    return (
      fm.source_model_id.toString() === file_id.toString() ||
      fm.template_id?.toString() === file_id.toString() ||
      fm._id.toString() === file_id.toString()
    )
  })
  return file
}

/**
 * @author Facugon
 * @summary Host tasks provisioning
 * @param {Host} host
 * @param {TaskTemplate[]} templates
 * @param {Customer} customer
 */
const copyTasksToHost = (host, filesMap, templates, customer) => {
  const promises = []
  for (let i=0; i<templates.length; i++) {
    const taskPromise = new Promise((resolve, reject) => {
      const template = templates[i]

      if (template.type === 'script' || /Script/.test(template._type)) {
        const script = getFile(template.script_id, filesMap)
        template.script_id = script._id.toString()
        template.script = script._id
      }

      App.task.createFromTemplate({
        template,
        customer,
        host,
        done: (err, task) => {
          if (err) { reject(err) }
          else { resolve(task) }
        }
      })
    })
    promises.push( taskPromise )
  }
  return Promise.all(promises)
}

/**
 * @author Facugon
 * @summary Host resources and monitors provisioning
 * @param {Host} host
 * @param {ResourceTemplate[]} templates
 * @param {Customer} customer
 * @param {Function} next
 */
const copyResourcesToHost = (host, filesMap, templates, customer, next) => {
  const promises = []
  for (let i=0; i<templates.length; i++) {
    let resourceTemplate = templates[i]
    const resourcePromise = resourceTemplate
      .populate('monitor_template')
      .execPopulate()
      .catch(err => reject(err))
      .then(() => {

        if (
          resourceTemplate.type === 'file' ||
          resourceTemplate.type === 'script'
        ) {
          const monitorTemplate = resourceTemplate.monitor_template
          if (monitorTemplate.type === 'script') {
            const file = getFile(monitorTemplate.config.script_id, filesMap)
            monitorTemplate.config.script_id = file._id.toString()
          } else {
            const file = getFile(monitorTemplate.config.file, filesMap)
            monitorTemplate.config.file = file._id.toString()
          }
        }

        return new Promise((resolve, reject) => {
          App.resource.createFromTemplate({
            template: resourceTemplate,
            customer,
            host,
            done: (err, resource) => {
              if (err) { reject(err) }
              else { resolve(resource) }
            }
          })
        })
      })
    promises.push(resourcePromise)
  }
  return Promise.all(promises)
}

/**
 * @author Facugon
 * @summary Remove template entity and all the clones of it
 * @param {String[]} templates
 * @param {Mongoose.Schema} TemplateSchema template schema
 * @param {Mongoose.Schema} LinkedSchema non template schema clone
 * @param {Boolean} keepClones to keep template instances instead of removing them completely
 */
const removeTemplateEntities = async (templates, TemplateSchema, LinkedSchema, keepClones, next) => {
  try {
    if (Array.isArray(templates) && templates.length > 0) {
      /**
       * @return {Promise}
       */
      const removeEntityTemplateClone = (entity) => {
        return Promise.all([
          entity.remove(),
          Event.deleteMany({ emitter_id: entity._id })
        ])
      }

      /**
       * @return {Promise}
       */
      const updateEntityTemplateClone = (entity) => {
        // update entities , removing parent template
        entity.template = null
        entity.template_id = null
        entity.last_update = new Date()
        return entity.save()
      }

      for (let id of templates) {
        await TemplateSchema.deleteOne({ _id: id })

        // remove entities linked to the template
        const entities = await LinkedSchema.find({ template_id: id })
        if (Array.isArray(entities) && entities.length > 0) {
          if (keepClones === true) {
            for (let i = 0; i < entities.length; i++) {
              updateEntityTemplateClone(entities[i]).catch(logger.error)
            }
          } else {
            for (let i = 0; i < entities.length; i++) {
              removeEntityTemplateClone(entities[i]).catch(logger.error)
            }
          }
        }
      }
    }
    next()
  } catch (err) {
    logger.error(err)
    next(err)
  }
}

/**
 * This is a long process to find Events via Emitters
 * and then assign Events to Tasks via Triggers
 *
 * @author Facugon
 * @summary Regerate the events structure of tasks/monitors/events
 * @param {Host} host the host
 * @param {Task[]} tasks host tasks
 * @param {Resource[]} resources host resources with its embedded monitors
 * @param {TriggerTemplate[]} triggers template triggers (linked to templates)
 */
const copyTriggersToHostTasks = (host, tasks, resources, triggers) => {
  if (triggers.length===0) { return }

  const searchTriggerEmitter = (trigger) => {
    var emitter
    // search current emitter id
    if (trigger.event_type === 'TaskEvent') {
      for (var j=0; j<tasks.length; j++) {
        if (tasks[j].template_id.toString() === trigger.emitter_id.toString()) {
          // found the task emitter
          emitter = tasks[j]
        }
      }
    } else if (trigger.event_type === 'MonitorEvent') {
      for (var k=0; k<resources.length; k++) {
        if (resources[k].monitor.template_id.toString() === trigger.emitter_id.toString()) {
          // found the monitor emitter
          emitter = resources[k].monitor
        }
      }
    } else {
      logger.error('unhandled trigger type %s', trigger.event_type)
      emitter = null
    }
    return emitter
  }

  const searchTriggerTask = (trigger) => {
    var task
    // trying to obtain the task to trigger
    for (var t=0; t<tasks.length; t++) {
      if (tasks[t].template_id.toString() === trigger.task_id.toString()) {
        task = tasks[t]
      }
    }
    return task
  }

  const getProcesableTrigger = (trigger) => {
    logger.log('processing trigger %s', trigger._id)

    var emitter = searchTriggerEmitter(trigger)
    if (emitter === null || !emitter) {
      return null
    }

    var task = searchTriggerTask(trigger)
    if (task === null || !task) {
      return null
    }

    logger.log('entities found matching trigger setup')
    logger.data('trigger: %j', trigger)
    logger.data('emitter: %j', emitter)
    logger.data('task: %j', task)

    return { task, trigger, emitter }
  }

  /**
   * @summary Search event and add to task.triggers
   * @param {Task} task
   * @param {String} eventName
   * @param {String} emitterId
   */
  const addEventToTaskTriggers = async (task, eventName, emitterId) => {
    logger.log('searchin events for task %s', task._id)
    logger.data('%j', task)

    const event = await Event.findOne({
      name: eventName,
      emitter: emitterId,
      //_type: trigger.event_type
    })

    if (!event) {
      throw new Error(`Named event ${eventName} for emitter ${emitterId} not found`)
    }

    logger.log('event found %s. added to task triggers', event._id)
    logger.data('%j',event)
    task.triggers.addToSet(event._id) // add only once
    return task.save()
  }

  logger.log('searching events for new task triggers')

  const promises = []
  for (let i=0; i<triggers.length; i++) {
    let procesable = getProcesableTrigger(triggers[i])
    if (procesable !== null) {
      promises.push(
        addEventToTaskTriggers(
          procesable.task,
          procesable.trigger.event_name,
          procesable.emitter._id
        ).catch(err => { return err })
      )
    }
  }

  return Promise.all(promises)
}

/**
 *
 * @param {Host} host
 * @param {Function(Error,Group[])}
 *
 */
const searchGroupsForHost = async (host) => {
  logger.log('searching group for host %s', host.hostname)
  const items = await HostGroup.find({
    customer: host.customer_id,
    hostname_regex: {
      $exists: true,
      $nin: [ null, "" ]
    }
  })

  if (!Array.isArray(items)||items.length===0) {
    return []
  }

  const groups = matchGroups(host.hostname, items)

  if (groups.length===0) {
    logger.log('not found any group')
    return []
  }

  return groups
}

/**
 * @param {HostGroup[]} groups
 */
const matchGroups = (name, groups) => {
  const matches = []
  for (var i=0; i<groups.length; i++) {
    var group = groups[i]
    if (Boolean(group.hostname_regex) !== false ) {
      var regex = new RegExp(group.hostname_regex)
      if (regex.test(name) === true) {
        matches.push(group)
      }
    }
  }
  return matches
}
