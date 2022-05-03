
const App = require('../app')

const isMongoId = require('validator/lib/isMongoId')
const logger = require('../lib/logger')('service:task')

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
const { ClientError, ServerError } = ErrorHandler

module.exports = {
  /**
   * @return {Promise}
   */
  factory (props) {
    validateProperties(props)

    return Factory.create(props)
  },
  async destroy (taskId) {
    const task = await App.Models.Task.Task.findById(taskId)
    if (!task) {
      logger.error(`Task not found ${taskId}`)
      return
    }

    return Promise.all([
      task.remove(),
      App.scheduler.unscheduleTask(task),
      App.Models.Event.Event.deleteMany({ emitter_id: task._id }),
      App.Models.Job.Job.deleteMany({ task_id: task._id.toString() })
    ])
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

    if (task.type === TaskConstants.TYPE_SCRIPT) {
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

      const task = await this.factory(input)

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
   * @return {Promise}
   *
   */
  async createTemplates (hostgroup, tasks, customer, user) {
    if (!tasks) { return [] }

    if (!Array.isArray(tasks) || tasks.length == 0) {
      return []
    }

    logger.log('processing %s tasks', tasks.length)
    const templates = []
    for (let task of tasks) {
      if (Object.keys(task).length === 0) {
        throw new Error('invalid task definition')
      }

      const data = Object.assign({}, task, {
        hostgroup_id: hostgroup._id,
        hostgroup: hostgroup,
        customer_id: customer._id,
        customer: customer,
        user_id: user.id,
        user: user,
        source_model_id: task.id,
        _id: undefined,
        secret: undefined
      })

      const template = TaskTemplate.Factory.create(data)
      templates.push(template.save())
    }
    logger.log('creating templates')
    return Promise.all(templates)
  },
  /**
   * @summary get task recipe
   * @param {Mixed} task instance or id
   * @param {Function} next
   */
  serialize (task, options, next) {
    const serial = task.serialize(options)

    // only script task
    if (task._type === 'ScriptTask') {
      App.file.serialize(task.script_id, options, (err, file) => {
        serial.script = file
        next(null, serial)
      })
    } else {
      next(null, serial)
    }
  },
  serializePromise (task, options) {
    return new Promise((resolve, reject) => {
      this.serialize(task, options, (err, data) => {
        if (err) { reject(err) }
        else { resolve(data) }
      })
    })
  }
}

const validateProperties = (input) => {
  const errors = new ErrorHandler()

  if (!input.name) { errors.required('name', input.name) }
  if (!input.type) { errors.required('type', input.type) }

  //if (
  //  input.type === TaskConstants.TYPE_SCRIPT ||
  //  input.type === TaskConstants.TYPE_SCRAPER
  //) {
  //  if (!input.host_id) {
  //    errors.required('host', input.host)
  //  }
  //}

  if (input.type === TaskConstants.TYPE_SCRIPT) {
    if (!input.script_id && !input.script) {
      errors.required('script', [input.script_id, input.script])
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
    const err = new ClientError('TaskValidationError', {statusCode: 400})
    err.errors = errors
    throw err
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

const createTags = (tags, customer) => {
  if (tags && Array.isArray(tags)) {
    Tag.create(tags, customer)
  }
}

const Factory = {
  async create (input) {
    delete input._type
    delete input.creation_date
    delete input.last_update
    delete input.secret

    if (input.hasOwnProperty('allows_dynamic_settings') === false) {
      input.allows_dynamic_settings = false
    }

    if (FactoryMethod.hasOwnProperty(input.type)) {
      const task = await FactoryMethod[input.type](input)

      const errors = task.validateSync()
      if (errors) {
        const err = new ClientError('TaskValidationError')
        err.statusCode = 400
        err.errors = errors
        throw err
      }
      return task.save()
    }
    throw new Error('Invalid type error: ' + input.type)
  }
}

const FactoryMethod = {}
FactoryMethod[ TaskConstants.TYPE_SCRAPER ] = App.Models.Task.ScraperTask
FactoryMethod[ TaskConstants.TYPE_APPROVAL ] = App.Models.Task.ApprovalTask
FactoryMethod[ TaskConstants.TYPE_DUMMY ] = App.Models.Task.DummyTask
FactoryMethod[ TaskConstants.TYPE_SCRIPT ] = async function (input) {
  let task = new App.Models.Task.ScriptTask(input)

  if (input.script_runas) {
    task.script_runas = input.script_runas
    if (/%script%/.test(input.script_runas) === false) {
      task.script_runas += ' %script%'
    }
  }

  if (input.script_id) {
    task.script = input.script_id
  } else if (input.script) {
    if (input.script.id) {
      const id = input.script.id
      task.script = id
      task.script_id = id
    } else {
      const attrs = input.script 
      attrs.customer = input.customer

      const script = await App.file.create(attrs)
      task.script_id = script._id
      task.script = script._id
    }
  } else {
    // ?? 
  }

  return task
}
FactoryMethod[ TaskConstants.TYPE_NOTIFICATION ] = function (input) {
  if (
    !Array.isArray(input.task_arguments) ||
    input.task_arguments.length === 0
  ) {
    delete input.task_arguments
  }
  return new App.Models.Task.NotificationTask(input)
}
