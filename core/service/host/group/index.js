'use strict'

const App = require('../../../app')
const after = require('lodash/after')
const assign = require('lodash/assign')
const config = require('config')
const async = require('async')
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
const AgentUpdateJob = require('../../../entity/job').AgentUpdate
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
                  AgentUpdateJob.create({ host_id: host._id })
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
  create (input, next) {
    const triggers = input.triggers
    const tasks = input.tasks
    const files = input.files
    const resources = input.resources
    const customer = input.customer
    const user = input.user
    const applyToSourceHost = input.applyToSourceHost

    var group

    /**
     * @summary check if input.hosts contains the same id as host_origin.  * remove it if present. will be added at the end of the process
     * @param {String} host
     * @param {String[]} hosts
     * @return {String[]}
     */
    const findAndRemove = (host,hosts) => {
      let idx = hosts.indexOf(host)
      if (idx > -1) {
        hosts.splice(idx, 1) // remove host
      }
      return hosts
    }

    const values = assign({}, input, {
      files: [],
      tasks: [],
      resources: [],
      user_id: user._id,
      customer_id: customer._id,
      customer_name: customer.name,
      hosts: findAndRemove(input.host_origin, input.hosts.slice())
    })

    logger.log('creating group %o', values)
    // create host templates
    group = new HostGroup(values)
    group.save(err => {
      if (err) {
        logger.error('%o',err)
        return next(err)
      }

      logger.log('creating recipe with provided data')
      createRecipe({
        tags: [],
        public: false,
        customer: customer._id,
        customer_id: customer._id,
        user: user._id,
        user_id: user._id,
        name: group.name,
        description: group.description,
        instructions: { resources, tasks, triggers, files },
        hostgroup: group._id,
        hostgroup_id: group._id
      }, (err) => {

        generateTemplates({
          group,
          tasks,
          resources,
          triggers,
          customer,
          user,
          files
        }, (err, templates) => {
          if (err) {
            logger.error('%o', err)
            return next(err)
          }

          logger.log('all templates created. attaching to group')
          // attach ids to template and save relations
          group.files = templates.files.map(f => f._id)
          group.triggers = templates.triggers
          group.resources = templates.resources.map(r => r._id)
          group.tasks = templates.tasks.map(t => t._id)
          group.save(err => {
            if (err) return next(err)

            // host template has been created ! populate all the data
            Service.populate(group,(err) => {
              if (err) { return next(err) }

              if (group.hosts.length > 0) {
                /**
                 * copy template configs to the attached hosts.
                 * group.hosts should be already populated,
                 * it is Host object Array
                 **/
                logger.log('copying template to hosts')
                for (let i=0; i<group.hosts.length; i++) {
                  let host = group.hosts[i]
                  if (host._id.toString() !== input.host_origin) {
                    copyTemplateToHost(
                      group.hosts[i],
                      group,
                      customer,
                      (err) => {}
                    )
                  }
                }
              }

              if (input.host_origin && applyToSourceHost === true) {
                addHostOriginToGroup(input.host_origin, group, customer, user, function (err) {
                  next(err, group)
                })
              } else {
                next(err, group)
              }
            })
          })
        }) // end generate templates callback

      }) // end of create recipe
    })
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
   * @param {Function(Error,HostGroup)} done
   */
  replace (input, done) {
    const self = this
    const group = input.group
    const customer = input.customer
    const keepInstances = !input.deleteInstances

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
              copyTemplateToHost(host, group, customer, () => { })
            })
          }
        }

        if (delHosts.length > 0) {
          for (var i=0; i < delHosts.length; i++) {
            findHost(delHosts[i], (err,host) => {
              if (err || !host) return
              unlinkHostFromTemplate(host, group, keepInstances, (err) => {
                AgentUpdateJob.create({ host_id: host._id })
              })
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
      if (error) { throw error }
      App.resource.populateAll(group.resources, (err) => {
        App.task.populateAll(group.tasks, (err) => {
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
        if (Boolean(group.hostname_regex) !== false ) {
          var regex = new RegExp(group.hostname_regex)
          if (regex.test(name) === true) {
            matches.push(group)
          }
        }
      }
      return matches
    }

    HostGroup.find({
      customer: host.customer_id,
      hostname_regex: {
        $exists: true,
        $nin: [ null, "" ]
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

  /**
   *
   *
   *
   */
  orchestrate (host, next) {
    this.searchGroupsForHost(host,(err, groups) => {
      if (err||!groups||groups.length===0) return next(err,null)

      const customer = groups[0].customer // @todo all the same customer. populate.customer may not be necessary. improve somehow

      const provisioningCompleted = after(groups.length, () => {
        next(null, groups)
      })

      // copy each matching template
      for (var i=0; i<groups.length; i++) {
        (function(group){ // ensure vars scope
          logger.log('using group regexp %s', group.hostname_regex)
          supplyHostWithTemplateInstructions(host, group, customer, (err) => {
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
 *
 *
 */
const createRecipe = (props, next) => {
  var recipe = new Recipe(props)
  recipe.save(err => {
    if (err) {
      logger.error('fail to create the template recipe')
      logger.error('%o', err)
    }

    next(err)
  })
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
      removeHostResources(host, (err) => {
        if (err) return next(err)
        copyTemplateToHost(host, group, customer, (err)=>{
          if (err) return next(err)

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
const generateTemplates = (input, done) => {
  logger.log('creating host templates')

  let { group, customer, user, files } = input
  let templates = {}

  App.file.createTemplates({
    group, 
    files
  }, (err, fileTpls) => {

    templates.files = fileTpls;

    (function updateFileTemplatesLinkedModels () {
      let tasks = input.tasks
      let resources = input.resources
      for (let fdx = 0; fdx < templates.files.length; fdx++) {
        let file = templates.files[fdx]
        if (!file.source_model_id) { continue }
        for (let rdx = 0; rdx < resources.length; rdx++) {
          let resource = resources[rdx]
          if (resource.type === 'file') {
            if (resource.monitor.config.file === file.source_model_id.toString()) {
              resource.monitor.config.file = file._id.toString()
              //resources.splice(rdx, 1)
              //break
            }
          } else if (resource.type === 'script') {
            if (resource.monitor.config && resource.monitor.config.script_id) {
              if (resource.monitor.config.script_id === file.source_model_id.toString()) {
                resource.monitor.config.script_id = file._id.toString()
                //resources.splice(rdx, 1)
                //break
              }
            }
          }
        }
        for (let tdx = 0; tdx < tasks.length; tdx++) {
          let task = tasks[tdx]
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
    })()

    async.series({
      // create tasks templates
      tasks: (next) => App.task.createTemplates(
        group, input.tasks, customer, user, next
      ),
      // create monitors templates
      resources: (next) => ResourceTemplateService.createTemplates(
        group, input.resources, customer, user, next
      )
    }, (err, result) => {
      if (err) { return done(err) }

      templates.resources = result.resources
      templates.tasks = result.tasks

      generateTasksTriggersTemplates(
        templates,
        input.triggers,
        (err, triggerTpls) => {
          if (err) { return done(err) }

          templates.triggers = triggerTpls

          return done(err, templates)
        }
      )
    })
  })
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
 * @param {Function} next, callback
 *
 */
const generateTasksTriggersTemplates = (templates, triggers, next) => {
  logger.log('binding triggers to task templates')
  const resources = templates.resources
  const tasks = templates.tasks
  const eventTemplates = []
  var task_id
  var source_id
  var events
  var taskTemplate

  if (!Array.isArray(tasks) || tasks.length===0) return next(null,[])
  if (!Array.isArray(triggers) || triggers.length===0) return next(null,[])

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

    if (!taskTemplate) { break }

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
              emitter_template_type: tasks[k]._type,
              task_template_id: taskTemplate._id, // triggered task template id
              task_template: taskTemplate._id, // triggered task template id
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
              emitter_template_type: resources[l].monitor_template._type,
              task_template_id: taskTemplate._id, // triggered task template id
              task_template: taskTemplate._id, // triggered task template id
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

  if (eventTemplates.length===0) {
    logger.log('no triggers to bind.')
  } else {
    logger.log('triggers binding completed')
  }
  return next(null, eventTemplates)
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
const unlinkHostFromTemplate = (host, template, keepInstances, next) => {
  next || (next = () => {})

  const removeEntity = (entity, done) => {
    entity.remove((e) => {
      if (e) {
        logger.error('Error removing entity')
        return done(e)
      }

      logger.log('entity %s removed', entity._type)

      // remove all events attached to the entity
      Event.remove({
        emitter_id: entity._id
      }).exec((e) => {
        if (e) {
          logger.error('Error removing entity events')
          return done(e)
        }

        logger.log('All entity events removed')
        return done()
      })
    })
  }

  const updateEntity = (entity, done) => {
    entity.template = null
    entity.template_id = null
    entity.last_update = new Date()
    entity.save(function (err, entity) {
      if (err) {
        logger.error('Error upadting entity')
        return done(err)
      }

      logger.log('entity %s updated', entity._type)
      return done()
    })
  }

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
  const removeSchemaTemplatedInstances = (Schema, template_id, done) => {
    Schema.find({
      host_id: host._id.toString(),
      template_id: template_id
    }).exec((err, entities) => {
      if (err) return done(err)

      if (!entities||entities.length===0) return done()

      const removed = after(entities.length, done)

      for (var i=0; i<entities.length; i++) {
        if(keepInstances === true) {
          updateEntity(entities[i], removed)
        } else {
          removeEntity(entities[i], removed)
        }
      }
    })
  }

  // remove from the host all the attached tasks with the given template_id
  //
  // the NEST !
  async.eachSeries(
    template.tasks,
    (taskTemplate,callback) => removeSchemaTemplatedInstances(
      Task,
      taskTemplate._id,
      callback
    ),
    (err) => {
      if (err) return next(err)

      // remove from the host all the attached resources
      // (and its monitor) with the given template
      async.eachSeries(
        template.resources,
        (resourceTemplate,callback) => {
          removeSchemaTemplatedInstances(
            Resource,
            resourceTemplate._id,
            (err) => {
              if (err) return callback(err)
              removeSchemaTemplatedInstances(
                Monitor,
                resourceTemplate.monitor_template_id,
                callback
              )
            }
          )
        },
        (err) => {
          if (err) return next(err)
        }
      )
    }
  )
}

/**
 * @author Facugon
 * @summary copy all template properties to the given host
 * @param {Host} host
 * @param {HostGroup} template
 * @param {Customer} customer
 * @param {Function} next
 */
const copyTemplateToHost = (host, template, customer, next) => {
  next || (next = ()=>{})

  /** @todo add async calls here to handle errors on creation process **/
  copyTasksToHost(host, template.tasks, customer, (err,tasks) => {
    copyResourcesToHost(host, template.resources, customer, (err, resources) => {
      copyTriggersToHostTasks(host, tasks, resources, template.triggers, (err) => {
        createRequiredFiles({
          customer,
          tasks,
          resources,
          files: template.files
        }, () => {
          if (err) {
            logger.error(err)
            return next(err)
          }
          logger.log('all entities processed')
          logger.log(tasks)

          AgentUpdateJob.create({ host_id: host._id })

          next()
        })
      })
    })
  })
}

const createRequiredFiles = (input, done) => {
  let { tasks, resources } = input
  let fetchedFiles = []

  const createTasksFiles = (cb) => {
    // seach files attached to newly created script tasks.
    // the assigned task.script_id belongs to a file template _id.
    async.eachSeries(
      tasks,
      (task, next) => {
        if (task.type!=='script') { return next() } // skip

        // try to get the file already created
        let query = FileModel
          .File
          .findOne({ template_id: task.script_id })

        query.exec((err, file) => {
          if (err) { return next(err) }
          if (!file) {
            // search the file template
            let fileTpl = input.files.find(f => {
              return f._id.toString() === task.script_id.toString()
            })

            if (!fileTpl) {
              logger.error('file template not found. perhaps this is an old template? skiping')
              return next()
            }

            logger.log('creating new file from template')
            // create a new file instance
            App.file.createFromTemplate({
              template: fileTpl,
              customer: input.customer
            }, (err, file) => {
              fetchedFiles.push(file)
              task.script_id = file._id
              task.script = file._id
              task.save(next)
            })
          } else {
            fetchedFiles.push(file)
            // use the already created file
            logger.log('using already existent file')
            task.script_id = file._id
            task.script = file._id
            task.save(next)
          }
        })
      },
      (err) => { cb() }
    )
  }

  const createMonitorsFiles = (cb) => {
    const setMonitorFile = (monitor, file, done) => {
      let _id = file._id ? file._id.toString() : ''
      if (monitor.type==='script') {
        monitor.config.script_id = _id
      } else if (monitor.type==='file') {
        monitor.config.file = _id
      }
      monitor.save(done)
    }

    async.eachSeries(
      resources,
      (resource, next) => {
        let monitor = resource.monitor
        let file_id, query

        if (resource.type==='script') {
          file_id = monitor.config.script_id
        }
        else if (resource.type==='file') {
          file_id = monitor.config.file
        }
        else return next()

        // try to get the file already created
        query = FileModel
          .File
          .findOne({ template_id: file_id })

        query.exec((err, file) => {
          if (err) { return next(err) }
          if (!file) {
            // search the file template
            let fileTpl = input.files.find(f => {
              return f._id.toString() === file_id.toString()
            })

            if (!fileTpl) {
              logger.error('file template not found. perhaps this is an old template? skiping')
              monitor.enable = false
              return setMonitorFile(monitor, { _id: null }, next)
            }

            logger.log('creating new file from template')
            // create a new file instance
            App.file.createFromTemplate({
              template: fileTpl,
              customer: input.customer
            }, (err, file) => {
              fetchedFiles.push(file)
              setMonitorFile(monitor, file, next)
            })
          } else {
            // use the already created file
            logger.log('using already existent file')
            fetchedFiles.push(file)
            setMonitorFile(monitor, file, next)
          }
        })
      },
      (err) => { cb() }
    )
  }

  createTasksFiles(() => createMonitorsFiles(done))
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
  const done = after(templates.length,() => {
    next(null,tasks)
  })

  if (templates.length===0) return next()

  for (let i=0; i<templates.length; i++) {
    App.task.createFromTemplate({
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
  const done = after(templates.length,() => {
    next(null,resources)
  })

  if (templates.length===0) return next(null,[])

  for (let i=0; i<templates.length; i++) {
    let template = templates[i]
    template.populate({}, (err) => {
      App.resource.createFromTemplate({
        customer: customer,
        template: template,
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
      if (err) {
        logger.error('%o',err)
        return done(err)
      }
      logger.log('removing entity %s [%s] events', entity._type, entity._id)
      Event.remove({ emitter_id: entity._id }).exec(err => {
        if (err) {
          logger.error('%o',err)
          return done(err)
        }
        done()
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

  async.eachSeries(templates, (id, done) => {
    // remove template
    TemplateSchema.remove({ _id: id }).exec(err => {
      if (err) return logger.error('%o',err)

      // remove entities linked to the template
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
          const removed = after(entities.length, () => {
            logger.log('all entities removed')
            return done()
          })
          for (var i=0; i<entities.length; i++) {
            removeEntityTemplateClone(entities[i],removed)
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
const supplyHostWithTemplateInstructions = (host, group, customer, done) => {
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
  if (triggers.length===0) return next()

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
  for (let i=0; i<triggers.length; i++) {
    procesable = getProcesableTrigger(triggers[i])
    if (typeof procesable === 'object') {
      procesableTriggers.push( procesable )
    }
  }

  // async operations part
  async.map(
    procesableTriggers,
    (proc,done) => {
      addEventToTaskTriggers(
        proc.task,
        proc.trigger.event_name,
        proc.emitter._id,
        (err, taskToSave) => {
          if (err) {
            logger.error('failed trying to link emitter %s to task %s', proc.emitter._id, proc.task._id)
            return done(err)
          }
          logger.log('trigger added')
          done(null, taskToSave)
        }
      )
    }, (err, tasksToSave) => {
      if (tasksToSave.length===0) return next()

      logger.log('saving tasks')
      const saved = []
      const saveCompleted = after(tasksToSave.length, next)
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
