'use strict'

const lodash = require('lodash')
const config = require('config')
const async = require('async')
const elastic = require('../../../lib/elastic')
const logger = require('../../../lib/logger')('service:host:group')

/** TEMPLATES **/
const Event = require('../../../entity/event').Event
const Host = require('../../../entity/host').Entity
const HostGroup = require('../../../entity/host/group').Entity
const ResourceTemplate = require('../../../entity/resource/template').Entity
const MonitorTemplate = require('../../../entity/monitor/template').Entity
const TaskTemplate = require('../../../entity/task/template').Template

/** NON TEMPLATES **/
const Monitor = require('../../../entity/monitor').Entity
const Resource = require('../../../entity/resource').Entity
const Task = require('../../../entity/task').Entity
const AgentUpdateJob = require('../../../entity/job').AgentUpdate
const TaskService = require('../../../service/task')
const ResourceService = require('../../../service/resource')
const ResourceTemplateService = require('../../../service/resource/template')

//exports.Monitor = require('./monitor')

const registerGroupCRUDOperation = (customer,data) => {
  const key = config.elasticsearch.keys.template.crud
  elastic.submit(customer,key,data)
}

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

    group.populateAll((err) => {
      if (err) {
        logger.error('%o',err)
        return done(err)
      }

      const tasks = group.tasks.map(t => t._id)
      const resources = group.resources.map(r => r._id)
      const monitors = group.resources.map(r => r.monitor_template_id)
      // remove in series
      removeTemplateEntities(tasks, TaskTemplate, Task, false, () => {
        removeTemplateEntities(resources, ResourceTemplate, Resource, false, () => {
          removeTemplateEntities(monitors, MonitorTemplate, Monitor, false, () => {
          })
        })
      })

      group.remove((err) => {
        if (err) return done(err)

        registerGroupCRUDOperation(group.customer_name,{
          name: group.hostname_regex,
          customer_name: group.customer_name,
          user_id: input.user.id,
          user_email: input.user.email,
          operation: 'delete'
        })
        done()
      })
    })
  },

  /**
   * @author Facugon
   * @summary create group definition.
   * @param {Object} input , group data properties
   * @property {Object[]} input.triggers, plain objects array
   * @property {Object[]} input.tasks, plain objects array
   * @property {Object[]} input.resources, plain objects array
   * @property {ObjectId[]} input.hosts, array of hosts objectid 
   * @property {Customer} input.customer
   * @property {User} input.user
   * @property {String} input.name
   * @property {String} input.description
   * @property {String} input.hostname_regex, a valid regular expression
   */
  create (input, next) {
    const triggers = input.triggers
    const tasks = input.tasks
    const resources = input.resources
    const customer = input.customer
    const user = input.user
    var group

    const values = lodash.assign({},input,{
      tasks: [],
      resources: [],
      user_id: user._id,
      customer_id: customer._id,
      customer_name: customer.name,
    })

    logger.log('creating group %o', values)
    // create host templates
    group = new HostGroup(values)
    group.save(err => {
      if (err) {
        logger.error('%o',err)
        return next(err)
      }

      logger.log('creating group templates')
      generateHostGroupTemplates(
        group,
        tasks,
        resources,
        triggers,
        customer,
        user,
        (err, templates) => {
          logger.log('all templates created. attaching to group')
          // attach ids to template and save relations
          group.triggers = templates.triggers
          group.resources = templates.resources.map(r => r._id)
          group.tasks = templates.tasks.map(t => t._id)
          group.save(err => {
            if (err) return next(err)

            registerGroupCRUDOperation(group.customer_name,{
              name: group.name,
              regexp: group.hostname_regex,
              customer_name: group.customer_name,
              user_id: user.id,
              user_email: user.email,
              operation: 'create'
            })

            // host template has been created ! populate all the data
            Service.populate(group,(err) => {
              if (err) return next(err)

              next(err, group)

              if (group.hosts.length > 0) {
                /** copy template configs to the attached hosts **/
                for (var i=0; i<group.hosts.length; i++) {
                  copyTemplateToHost(group.hosts[i], group, customer)
                }
              }
            })
          })
        } // end generate templates callback
      )
    })
  },

  /**
   * @author Facugon
   * @summary Replace host template configuration
   * @param {Object} input
   * @property {Customer} input.customer
   * @property {HostGroup} input.group
   * @property {String} input.name
   * @property {String} input.description
   * @property {String} input.hostname_regex a valid RegExp Pattern
   * @property {String[]} input.hosts valid ObjectId string array
   * @property {Object[]} input.tasks valid ObjectId string array
   * @property {Object[]} input.resources valid ObjectId string array
   * @param {Function(Error,HostGroup)} done
   */
  replace (input, done) {
    const self = this
    const group = input.group
    const customer = input.customer

    // host elements only present in group.hosts.
    // group.hosts is an array of mongo ObjectID
    const delHosts = group.hosts.filter(idobj => input.hosts.indexOf(idobj.toString()) === -1)

    // host elements only present in input.hosts
    // input.hosts is an array of strings
    const newHosts = input.hosts.filter(idstr => group.hosts.indexOf(idstr) === -1)

    /* 
     * @todo match hosts with hostname_regex, add matches to group.hosts
     */
    //const regexHasChanged = Boolean(input.hostname_regex !== group.hostname_regex)
    //if (regexHasChanged) {
    //}

    group.name = input.name
    group.hosts = input.hosts
    group.description = input.description
    group.hostname_regex = input.hostname_regex
    group.save((err) => {
      if (err) {
        logger.error('Error saving group updates')
        logger.error(err)
        return done(err) // stop the process here
      }

      self.populate(group,(err) => {
        if (err) return done(err)
        done(null,group) // do not return here.

        // the rest of the process will continue async
        if (newHosts.length > 0) {
          for (var i=0; i < newHosts.length; i++) {
            findHost(newHosts[i],(err,host) => {
              if (err || !host) return
              copyTemplateToHost(host, group, customer)
            })
          }
        }

        if (delHosts.length > 0) {
          for (var i=0; i < delHosts.length; i++) {
            findHost(delHosts[i], (err,host) => {
              if (err || !host) return
              unlinkHostFromTemplate(host, group)
            })
          }
        }
      })
    })
  },

  /**
   * @author Facundo
   */
  populate (group, next) {
    next || (next = function(){})
    logger.log('publishing group')
    group.populateAll(error => {
      if (error) throw error

      ResourceService.populateAll(group.resources, (err) => {
        TaskService.populateAll(group.tasks, (err) => {
          var data = group.toObject()
          next(null, data)
        })
      })
    })
  },

  /**
   *
   * @param {Host} host
   * @param {Function(Error,Group[])}
   *
   */
  searchGroupsForHost (host, next) {
    logger.log('searching group for host %s', host.hostname);
    /**
     * @param {HostGroup[]} groups
     */
    const matchGroups = (name, groups) => {
      const matches = []
      for (var i=0; i<groups.length; i++) {
        var group = groups[i]
        var regex = new RegExp(group.hostname_regex)
        if (regex.test(name) === true) {
          matches.push(group)
        }
      }
      return matches
    }

    HostGroup.find({
      customer: host.customer_id,
      hostname_regex: {
        $exists: true,
        $ne: null
      }
    }).populate('customer').exec((err, items) => {
      if (err) {
        logger.error(err)
        return next(err,[])
      }

      if (!Array.isArray(items)||items.length===0) {
        return next(null,[])
      }

      const groups = matchGroups(host.hostname, items)

      if (groups.length===0) {
        logger.log('not found any group')
        return next(null,[])
      }

      next(null, groups)
    })
  },

  orchestrate (host, next) {
    this.searchGroupsForHost(host,(err, groups) => {
      if (err||!groups||groups.length===0) return next(err,null)

      const customer = groups[0].customer // @todo all the same customer. populate.customer may not be necessary. improve somehow

      const provisioningCompleted = lodash.after(groups.length,() => {
        next(null, groups)
      })

      // copy each matching template
      for (var i=0; i<groups.length; i++) {
        (function(group){ // ensure vars scope
          logger.log('using group regexp %s', group.hostname_regex)
          supplyHostWithTemplate(host, group, customer, (err) => {
            if (err) logger.error(err)

            group.hosts.addToSet(host._id)
            group.save(err => logger.error(err))

            logger.log('group %s provisioning completed', group.hostname_regex)

            provisioningCompleted()
          })
        })(groups[i])
      }
    })
  }
}

/**
 *
 * @param {HostGroup} group
 * @param {Object[]} tasks, tasks definitions/properties
 * @param {Object[]} resources, resources & monitors definitions/properties
 * @param {Object[]} triggers, task event triggers. each object contains a task id and events from tasks and monitors on the same host
 * @param {Customer} customer
 * @param {User} user
 * @param {Function} done, callback
 *
 */
const generateHostGroupTemplates = (group,tasks,resources,triggers,customer,user,done) => {
  // create tasks and monitors templates
  async.series({
    tasks: (done) => TaskService.createTemplates(
      group, tasks, customer, user, done
    ),
    resources: (done) => ResourceTemplateService.createTemplates(
      group, resources, customer, user, done
    )
  }, (err, templates) => {
    if (err) {
      return done(err)
    }

    logger.log('binding triggers to task templates')
    //return done(err, templates)
    generateTasksTriggersTemplates(
      templates,
      triggers,
      (err, triggersTemplates) => {
        templates.triggers = triggersTemplates
        logger.log('triggers binding completed')
        return done(err, templates)
      }
    )
  })
}

/**
 *
 * WTF is this...? the templates were linked to its source model, when available.
 *
 * (source_model_id is available when the template was generated from another model)
 *
 * Here source_model_id is used to match the trigger of the original task to 
 * the task template and register triggers relations within the host template.
 * This enables the template to recreate tasks and monitors relations at the
 * moment of host registration.
 *
 * @param {Object} templates
 * @property {TaskTemplate[]} templates.tasks
 * @property {ResourceTemplate[]} templates.resources, templates.resources[].monitor_template should be populated here
 * @param {Object[]} triggers
 * @param {Function} next, callback
 *
 */
const generateTasksTriggersTemplates = (templates, triggers, next) => {
  const resources = templates.resources
  const tasks = templates.tasks
  const eventTemplates = []
  var task_id
  var source_id
  var events
  var taskTemplate

  if (!Array.isArray(tasks) || tasks.length===0) return next(err,[])
  if (!Array.isArray(triggers) || triggers.length===0) return next(err,[])

  for (var i=0; i<triggers.length; i++) {
    task_id = triggers[i].task_id
    events = triggers[i].events

    if (!task_id) break
    if (!Array.isArray(events) || events.length===0) break

    // search task for this triggers
    taskTemplate = tasks.find(task => {
      return task.source_model_id && (
        task_id === task.source_model_id.toString()
      )
    })

    if (!taskTemplate) break

    // for each event trigger of the taskTemplate
    for (var j=0; j<events.length; j++) {
      // search the template via it's original emitter (task/monitor)
      if (events[j]._type === 'TaskEvent') {
        // task templates emitter
        for (var k=0; k<tasks.length; k++) {
          source_id = tasks[k].source_model_id.toString()
          if (source_id === events[j].emitter_id) {
            eventTemplates.push({
              event_type: events[j]._type, // the instance of Event to create
              event_name: events[j].name, // something to distinguish the event
              emitter_template_id: tasks[k]._id, // emitter task template id
              task_template_id: taskTemplate._id, // triggered task template id
            })
          }
        }
      } else if (events[j]._type === 'MonitorEvent') {
        // monitor templates emitter
        for (var l=0; l<resources.length; l++) {
          source_id = resources[l].monitor_template.source_model_id.toString()
          if (source_id === events[j].emitter_id) {
            eventTemplates.push({
              event_type: events[j]._type, // the instance of Event to create
              event_name: events[j].name, // something to distinguish the event
              emitter_template_id: resources[l].monitor_template._id, // emitter monitor template id
              task_template_id: taskTemplate._id, // triggered task template id
            })
          }
        }
      } else {
        // unexpected templates emitter
        logger.error('emitter type %s won\'t be registered',events[j]._type)
        break
      }
    }
  }

  return next(null,eventTemplates)
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
 * @param {Function} next
 */
const unlinkHostFromTemplate = (host, template, next) => {

  const removeEntity = (entity, done) => {
    entity.remove((e) => {
      if (e) {
        logger.error('Error removing entity')
        return done(e)
      }

      // remove all events attached to the entity
      Event.remove({
        emitter_id: entity._id
      }).exec((e) => {
        if (e) {
          logger.error('Error removing entity events')
          return done(e)
        }

        logger.log('All entities and events removed')
        return done()
      })
    })
  }

  /**
   * @param {Mongoose.Schema} Schema
   * @param {Object} entityTemplate
   * @param {Function} done
   */
  const removeSchemaEntities = (Schema, entityTemplate, done) => {
    Schema.find({
      host_id: host._id.toString(),
      template_id: entityTemplate._id
    }).exec((err, entities) => {
      if (!entities||entities.length===0) return

      for (var i=0; i<entities.length; i++) {
        removeEntity(entities[i], done)
      }
    })
  }

  // in all cases :
  // * host_id (old property) is a mongo db string id.
  // * template_id (new property) is a native ObjectID mongo type

  // remove all attached tasks to the host for the given template
  for (var t=0; t<template.tasks.length; t++) {
    const tplTask = template.tasks[t]
    removeSchemaEntities(Task, tplTask, () => {})
  }

  // remove all attached resources (and its monitor) to the host for the given template
  for (var r=0; r<template.resources.length; r++) {
    const tplResource = template.resources[r]

    removeSchemaEntities(Resource, tplResource, () => {})
    removeSchemaEntities(Task, tplResource.monitor_template_id, () => {})
  }
}

/**
 * @author Facugon
 * @summary Given a host, copy task and monitor templates to it
 * @param {Host} host
 * @param {HostGroup} template
 * @param {Customer} customer
 * @param {Function} next
 */
const copyTemplateToHost = (host, template, customer, next) => {
  next || (next = ()=>{})

  // add async calls here to handle errors on creation process
  copyTasksToHost(host, template.tasks, customer, (err,tasks) => {
    copyResourcesToHost(host, template.resources, customer, (err, resources) => {
      copyTriggersToHostTasks(host, tasks, resources, template.triggers, (err) => {
        if (err) {
          logger.error(err)
          return next(err)
        }
        logger.log('all entities processed')
        logger.log(tasks)
        next()
      })
    })
  })
}

/**
 * @author Facugon
 * @summary Host tasks provisioning
 * @param {Host} host
 * @param {TaskTemplate[]} templates
 * @param {Customer} customer
 * @param {Function} next
 */
const copyTasksToHost = (host, templates, customer, next) => {
  const tasks = []
  const done = lodash.after(templates.length,() => {
    next(null,tasks)
  })

  for (var i=0; i<templates.length; i++) {
    TaskService.createFromTemplate({
      customer: customer,
      template: templates[i],
      host: host,
      done: (err, task) => {
        if (err) {
          logger.error('%o',err)
        } else {
          tasks.push(task)
        }
        done()
      }
    })
  }
}

/**
 * @author Facugon
 * @summary Host resources and monitors provisioning
 * @param {Host} host
 * @param {ResourceTemplate[]} templates
 * @param {Customer} customer
 * @param {Function} next
 */
const copyResourcesToHost = (host, templates, customer, next) => {
  const resources = []
  const done = lodash.after(templates.length,() => {
    next(null,resources)
  })

  for (var i=0; i<templates.length; i++) {
    ResourceService.createFromTemplate({
      customer: customer,
      template: templates[i],
      host: host,
      done: (err, resource) => {
        if (err) {
          logger.error('%o',err)
        } else {
          resources.push(resource)
        }
        done()
      }
    })
  }
}

/**
 * @author Facugon
 * @summary Remove template entity and all the clones of it
 * @param {String[]} templates
 * @param {Mongoose.Schema} TemplateSchema template schema
 * @param {Mongoose.Schema} LinkedSchema non template schema clone
 * @param {Boolean} keepClones to keep template instances instead of removing them completely
 */
const removeTemplateEntities = (templates, TemplateSchema, LinkedSchema, keepClones, next) => {
  if (!Array.isArray(templates)||templates.length===0) {
    return next()
  }

  const removeEntityTemplateClone = (entity,done) => {
    entity.remove(err => {
      if (err) return logger.error('%o',err)
      logger.log('removing entity %s [%s] events', entity._type, entity._id)
      Event.remove({ emitter_id: entity._id }).exec(err => {
        if (err) return logger.error('%o',err)
      })
    })
  }

  const updateEntityTemplateClone = (entity,done) => {
    // update entities , removing parent template
    entity.template = null
    entity.template_id = null
    entity.last_update = new Date()
    entity.save(err => {
      if (err) logger.error('%o',err)
      done(err)
    })
  }

  const removeEntityTemplate = () => {
  }

  async.eachSeries(templates, (id, done) => {
    // remove templates
    TemplateSchema.remove({ _id: id }).exec(err => {
      if (err) return logger.error('%o',err)

      // remove template from linked entities
      LinkedSchema.find({ template_id: id }).exec((err,entities) => {
        if (err) return done(err)
        if (!Array.isArray(entities)||entities.length===0) {
          return done()
        }

        if (keepClones === true) {
          for (var i=0; i<entities.length; i++) {
            updateEntityTemplateClone(entities[i],()=>{})
          }
          // do not wait until all entities are updated
          return done()
        } else {
          // remove all
          for (var i=0; i<entities.length; i++) {
            removeEntityTemplateClone(entities[i],()=>{})
          }
        }
      })
    })
  }, (err) => {
    if (err) logger.error(err)
    next(err)
  })
}

/**
 * @author Facugon
 *
 * @param {Host} host
 * @param {Group} group
 * @param {Customer} customer
 * @param {Function} done
 */
const supplyHostWithTemplate = (host, group, customer, done) => {
  Service.populate(group,(err) => {
    copyTemplateToHost(host, group, customer, (err) => {
      done(err)
    })
  })
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
 * @param {Function} next callback
 */
const copyTriggersToHostTasks = (host, tasks, resources, triggers, next) => {
  const searchTriggerEmitter = (trigger) => {
    var emitter
    // search current emitter id
    if (trigger.event_type === 'TaskEvent') {
      for (var j=0; j<tasks.length; j++) {
        if (tasks[j].template_id.toString() === trigger.emitter_template_id.toString()) {
          // found the task emitter
          emitter = tasks[j]
        }
      }
    } else if (trigger.event_type === 'MonitorEvent') {
      for (var k=0; k<resources.length; k++) {
        if (resources[k].monitor.template_id.toString() === trigger.emitter_template_id.toString()) {
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
      if (tasks[t].template_id.toString() === trigger.task_template_id.toString()) {
        task = tasks[t]
      }
    }
    return task
  }

  const getProcesableTrigger = (trigger) => {
    logger.log('processing trigger %s', trigger._id)

    var emitter = searchTriggerEmitter(trigger)
    if (emitter===null||!emitter) return null

    var task = searchTriggerTask(trigger)
    if (task===null||!task) return null

    logger.log('entities found matching trigger setup')
    logger.data('trigger: %j',trigger)
    logger.data('emitter: %j',emitter)
    logger.data('task: %j',task)

    return {
      task: task,
      trigger: trigger,
      emitter: emitter
    }
  }

  /**
   * @summary Search event and add to task.triggers
   * @param {Task} task
   * @param {String} eventName
   * @param {String} emitterId
   * @param {Function(Error,Task)} done callback
   */
  const addEventToTaskTriggers = (task, eventName, emitterId, done) => {
    logger.log('searchin events for task %s', task._id)
    logger.data('%j', task)

    Event.findOne({
      name: eventName,
      emitter: emitterId,
      //_type: trigger.event_type
    }).exec((err,event) => {
      if (err) {
        logger.error(err)
        return done(err)
      }
      if (!event) {
        var err = new Error(`named event ${eventName} for emitter ${emitterId} not found`)
        logger.error(err.message)
        return done(err)
      }

      logger.log('event found %s. added to task triggers', event._id)
      logger.data('%j',event)
      task.triggers.addToSet(event._id) // add only once
      //task.triggers.push(event._id)
      //task.save((err) => { return done(err) })
      done(null, task)
    })
  }

  logger.log('searching events for new task triggers')

  var procesableTriggers = []
  var procesable
  for (var i=0; i<triggers.length; i++) {
    procesable = getProcesableTrigger(triggers[i])
    if (typeof procesable === 'object') {
      procesableTriggers.push( procesable )
    }
  }

  // async operations part
  async.map(
    procesableTriggers,
    function(proc,done){
      addEventToTaskTriggers(
        proc.task,
        proc.trigger.event_name,
        proc.emitter._id,
        (err, taskToSave) => {
          if (err) {
            logger.error('trying to link emitter %s to task %s', emitter._id, task._id)
            return done(err)
          }
          logger.log('trigger added')
          done(null, taskToSave)
        }
      )
    },
    (err, tasksToSave) => {
      if (tasksToSave.length===0) return next()

      logger.log('saving tasks')
      const saved = []
      const saveCompleted = lodash.after(tasksToSave.length, next)
      const saveTask = (task) => {
        var id = task._id.toString()
        // if not saved
        if (saved.indexOf(id) === -1) {
          saved.push(id)
          task.save((err) => {
            logger.log('task %s saved', id)
            saveCompleted()
          })
        } else {
          logger.log('%s skipped', id)
          saveCompleted()
        }
      }

      for (var t=0; t<tasksToSave.length; t++) {
        saveTask(tasksToSave[t])
      }
    }
  )
}
