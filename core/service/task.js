
const App = require('../app')

const isMongoId = require('validator/lib/isMongoId')
const logger = require('../lib/logger')('service:task')
const asyncMap = require('async/map')

const Tag = require('../entity/tag').Entity
const Host = require('../entity/host').Entity
const Task = require('../entity/task').Entity
const TaskEvent = require('../entity/event').TaskEvent
const Job = require('../entity/job').Job
const Constants = require('../constants')
const LifecycleConstants = require('../constants/lifecycle')
const TaskConstants = require('../constants/task')
const TopicsConstants = require('../constants/topics')

const TaskTemplate = require('../entity/task/template')

// var filter = require('../router/param-filter');
const FetchBy = require('../lib/fetch-by')
const ErrorHandler = require('../lib/error-handler')

module.exports = {
  /**
   * @return {Promise}
   */
  factory (props) {
    validateProperties(props)

    const task = App.Models.Task.Factory.create(props)
    const errors = task.validateSync()
    if (errors) {
      const err = new ClientError('TaskValidationError')
      err.errors = errors
      throw err
    }

    return task.save()
  },
  /**
   * @summary Remove task
   * @param {Object} options
   * @property {Task} options.task
   * @property {Function} options.fail failure function
   * @property {Function} options.done success function
   */
  remove (options) {
    const task = options.task
    if (task.workflow_id) {
      return options.fail(new Error('Cannot delete a task that belongs to a workflow.'))
    } else {
      Task
        .find({ _id: task._id })
        .remove()
        .exec(err => {
          if (err) { return options.fail(err) }

          App.scheduler.unscheduleTask(task)

          TaskEvent
            .find({ emitter_id: task._id })
            .remove()
            .exec(err => {
              if (err) { return options.fail(err) }

              Job
                .find({ task_id: task._id.toString() })
                .remove()
                .exec(err => {
                  if (err) { return options.fail(err) }
                  options.done()
                })
            })
        })
    }
  },
  /**
   *
   * @param {Object} options
   *
   */
  async update (options) {
    const task = options.task
    const updates = options.updates

    updates.host = updates.host_id
    // unset template when modifying task
    updates.template = null
    updates.template_id = null
    delete updates._id // if set

    if (updates.workflow_id) { delete updates.acl }

    task.set(updates)

    // keep backward compatibility with script_arguments
    if (task.type === TaskConstants.TYPE_SCRIPT) {
      task.script_arguments = updates.task_arguments
      let runas = updates.script_runas
      if (runas) {
        if (/%script%/.test(runas) === false) {
          runas += ' %script%'
          task.script_runas = runas
        }
      }
    }

    try {
      await task.save()
      createTags(task.tags, task.customer)
      logger.log('publishing task')
      options.done( await this.populate(task) )
    } catch (e) {
      if (err.name === 'ValidationError') {
        err.statusCode = 400
      }
      return options.fail(err)
    }
  },
  /**
   *
   * @author Facundo
   *
   */
  fetchBy (filter, next) {
    FetchBy.call(Task, filter, async (err, tasks) => {
      if (err) { return next(err) }
      if (tasks.length === 0) { return next(null, tasks) }

      let published = []
      for (let index in tasks) {
        let task = tasks[index]
        let data = await this.populate(task) 
        published.push(data)
      }
      next(null, published)
    })
  },
  /**
   *
   * @author Facundo
   * @param {Object} options
   * @property {TaskTemplate} options.template
   * @property {Customer} options.customer
   * @property {Host} options.host
   * @property {Function(Error,Object)} options.done
   *
   */
  createFromTemplate (options) {
    const template = options.template // plain object
    const customer = options.customer
    const host = options.host || {}
    const done = options.done || (() => {})

    logger.log('creating task from template %j', template)

    let templateData
    if (template.toObject) {
      templateData = template.toObject()
    } else {
      templateData = template
    }

    let data = Object.assign({}, templateData, {
      customer_id: customer._id,
      customer: customer,
      host: host._id,
      host_id: host._id,
      template_id: template._id,
      template: template._id
    })

    delete data._id
    delete data.id
    delete data.user_id
    delete data.workflow_id
    delete data.workflow

    this.create(data, (err,task) => {
      done(err, task)
    })
  },
  /**
   * @author Facugon
   * @summary Create a task
   * @param {Object} input
   * @property {Customer} input.customer
   * @property {Host} input.host
   * @property {TaskTemplate} input.template
   * @param {Function(Error,)} done
   */
  async create (input, done) {
    try {
      logger.log('creating task')
      logger.data(input)

      const task = App.Models.Task.Factory.create(input)

      let errors = task.validateSync()
      if (errors) {
        let err = new Error('TaskValidationError')
        err.statusCode = 400
        err.errors = errors
        throw err
      }

      await task.save()

      const customer = input.customer
      createTags(input.tags, customer)
      createTaskEvents(task, customer)

      logger.log('task created')
      logger.data(task)
      return done(null, task)
    } catch (err) {
      logger.error(err)
      done(err)
    }
  },
  async populateAll (tasks, next) {
    let populated = []
    if (!Array.isArray(tasks)||tasks.length===0) {
      return next(null, populated)
    }

    for (let i=0; i<tasks.length; i++) {
      const task = tasks[i]
      populated.push( await this.populate(task) )
    }

    next(null, populated)
  },
  async populate (task) {
    const data = task.toObject()

    // only if host_id is set
    const populateHost = (task) => {
      return new Promise( (resolve, reject) => {
        const id = task.host_id
        if (!id) { return resolve() }

        const data = { host: null, hostname: '' }
        Host.findById(id, (err, host) => {
          if (err) { return reject(err) }
          if (host !== null) {
            data.host = host
            data.hostname = host.hostname
          }

          return resolve(data)
        })
      })
    }

    // only task type script, and if script_id is set
    const populateScript = async (task) => {
      if (task.type !== TaskConstants.TYPE_SCRIPT) {
        return {}
      }

      const data = { script: null, script_id: '', script_name: '' }
      const id = task.script_id
      if (!id) {
        return data
      }

      const script = await App.Models.File.Script
        .findById(id)
        .select({ _id: 1, filename: 1 })
        .exec()

      if (script !== null) {
        data.script = script
        data.script_id = script._id
        data.script_name = script.filename
      }

      return data
    }

    const populateSchedules = (task) => {
      return new Promise( (resolve, reject) => {
        App.scheduler.getTaskSchedule(task._id, (err, schedules) => {
          if (err) { reject(err) }
          else { resolve({ schedules }) }
        })
      })
    }

    const relations = await Promise.all([
      await populateScript(task),
      await populateHost(task),
      await populateSchedules(task)
    ])

    return (
      relations.reduce((accum, curr) => {
        return Object.assign(accum, curr)
      }, data)
    )
  },
  /**
   *
   * Given a task document, replace its id and set to new, ready to persist.
   * Also create new events
   *
   * @param {Task} task
   * @param {Function} next
   *
   */
  mutateNew (task, next) {
    task.mutateNew()
    task.save()
    createTaskEvents(task, task.customer, next)
  },
  unlinkTaskFromWorkflow (task_id, next) {
    next || (next=()=>{})
    Task.findById(task_id, (err, task) => {
      if (err) {
        logger.error(err)
        return next(err)
      }

      if (!task) {
        return next()
      }

      task.workflow_id = null
      task.workflow = null
      task.acl = []

      task.save(err => {
        if (err) {
          logger.error(err)
          return next(err)
        } else {
          sendTaskUpdatedEventNotification(task)
          return next()
        }
      })
    })
  },
  assignTaskToWorkflow (task_id, workflow, next) {
    next || (next=()=>{})
    Task.findById(task_id, (err, task) => {
      if (err) {
        logger.error(err)
        return next(err)
      }

      if (!task) {
        logger.error('Workflow task not found!')
        return next()
      }

      task.workflow_id = workflow._id
      task.workflow = workflow._id
      task.acl = workflow.acl

      task.save(err => {
        if (err) {
          logger.error(err)
          return next(err)
        } else {
          sendTaskUpdatedEventNotification(task)
          return next()
        }
      })
    })
  },
  assignWorkflowAclToTask (taskId, workflow, next) {
    next || (next=()=>{})
    Task.findById(taskId, (err, task) => {
      if (err) {
        logger.error(err)
        return next(err)
      }

      if (!task) {
        logger.error('Workflow task not found!')
        return next()
      }

      task.acl = workflow.acl
      task.save(err => {
        if (err) {
          logger.error(err)
          return next(err)
        }

        sendTaskUpdatedEventNotification(task)
        return next()
      })
    })
  },
  /**
   *
   * Handle tasks. Validate type and data, create templates
   *
   * @author Facundo
   * @param {HostGroup} hostgroup
   * @param {Array<Task>} tasks
   * @param {Customer} customer
   * @param {User} user
   * @param {Function} done
   *
   */
  createTemplates (hostgroup, tasks, customer, user, done) {
    if (!tasks) { return done(null,[]) }

    if (!Array.isArray(tasks) || tasks.length == 0) {
      return done(null,[])
    }

    logger.log('processing %s tasks', tasks.length)

    const createTemplateEntity = (data, next) => {
      logger.log('creating task template')
      logger.data('%j', data)

      delete data._type

      let template
      if (data.type === 'scraper') {
        template = new TaskTemplate.ScraperTemplate(data)
      } else {
        data.script = data.script_id
        template = new TaskTemplate.ScriptTemplate(data)
      }
      template.save(err => next(err, template))
    }

    asyncMap(
      tasks,
      (task, next) => {
        if (Object.keys(task).length === 0) {
          const err = new Error('invalid task definition');
          err.statusCode = 400;
          return next(err)
        }

        let data = Object.assign({}, task)
        data.hostgroup_id = hostgroup._id
        data.hostgroup = hostgroup
        data.customer_id = customer._id
        data.customer = customer
        data.user_id = user.id
        data.user = user
        data.source_model_id = task.source_model_id
        data.triggers = task.triggers || []
        if (data._id) { delete data._id } // must be autogenerated
        if (data.secret) { delete data.secret } // autogenerated too

        createTemplateEntity(data, (err, template) => {
          if (err) {
            logger.error('fail to create task template')
            logger.error(err, err.errors)
            return next(err)
          }
          logger.log('task template %s created', template._id)
          next(null, template)
        })
      },
      (err, templates) => {
        if (err) {
          logger.error(err)
          return done(err)
        }
        logger.log('all task templates created')
        return done(null, templates)
      }
    )
  },
  /**
   * @summary get task recipe
   * @param {Mixed} task instance or id
   * @param {Function} next
   */
  getRecipe (task, next) {
    let data = {}

    data.task = task.templateProperties()
    // only script task
    if (task._type === 'ScriptTask') {
      App.file.getRecipe(task.script_id, (err, fprops) => {
        data.file = fprops
        next(null, data)
      })
    } else {
      next(null, data)
    }
  }
}

const validateProperties = (input) => {
  const errors = new ErrorHandler()

  if (!input.name) { errors.required('name', input.name) }
  if (!input.type) { errors.required('type', input.type) }

  if (
    input.type === TaskConstants.TYPE_SCRIPT ||
    input.type === TaskConstants.TYPE_SCRAPER
  ) {
    if (!input.host_id) { errors.required('host', req.host) }
  }

  if (input.type === TaskConstants.TYPE_SCRIPT) {
    if (!input.script_id) {
      errors.required('script', input.script_id)
    }
    if (!input.script_runas) {
      errors.required('script_runas', input.script_runas)
    }
  }

  if (input.type === TaskConstants.TYPE_APPROVAL) { }
  if (input.type === TaskConstants.TYPE_SCRAPER) { }
  if (input.type === TaskConstants.TYPE_DUMMY) { }
  if (input.type === TaskConstants.TYPE_NOTIFICATION) { }

  if (errors.hasErrors()) {
    throw new ClientError(errors)
  }
}

// not yet
const sendTaskUpdatedEventNotification = (task) => {
  return
  //const topic = TopicsConstants.task.crud
  //App.notifications.generateSystemNotification({
  //  topic: topic,
  //  data: {
  //    model_type: task._type,
  //    model: task,
  //    hostname: task.hostname,
  //    organization: task.customer_name,
  //    operation: Constants.UPDATE
  //  }
  //})
}

const createTaskEvents = (task, customer, next) => {
  next||(next=function(){})

  TaskEvent.create(
    {
      name: 'success',
      customer: customer,
      customer_id: customer._id,
      emitter: task,
      emitter_id: task._id,
    },
    {
      name: 'failure',
      customer: customer,
      customer_id: customer._id,
      emitter: task,
      emitter_id: task._id,
    },
    (err, events) => {
      if (err) { logger.error(err) }
      return next(err, events)
    }
  )
}

const toObject = () => {
  return
}

const createTags = (tags, customer) => {
  if (tags && Array.isArray(tags)) {
    Tag.create(tags, customer)
  }
}
