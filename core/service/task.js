'use strict'

const App = require('../app')

const isMongoId = require('validator/lib/isMongoId')
const logger = require('../lib/logger')('service:task')
const asyncMap = require('async/map')

const lodashAssign = require('lodash/assign')
const lodashAfter = require('lodash/after')
const lodashExtend = require('lodash/extend')

const Tag = require('../entity/tag').Entity
const Host = require('../entity/host').Entity
const Task = require('../entity/task').Entity
const TaskFactory = require('../entity/task').Factory
const TaskEvent = require('../entity/event').TaskEvent
const Script = require('../entity/file').Script
const Job = require('../entity/job').Job
const Constants = require('../constants')
const LifecycleConstants = require('../constants/lifecycle')
const TaskConstants = require('../constants/task')
const TopicsConstants = require('../constants/topics')

const TaskTemplate = require('../entity/task/template')

// var filter = require('../router/param-filter');
//const elastic = require('../lib/elastic')
const FetchBy = require('../lib/fetch-by')

module.exports = {
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
  update (options) {
    const self = this
    const done = options.done
    const task = options.task
    const updates = options.updates

    updates.host = updates.host_id
    // unset template when modifying task
    updates.template = null
    updates.template_id = null
    delete updates._id // if set

    task.set(updates)

    // keep backward compatibility with script_arguments
    if (task.type===TaskConstants.TYPE_SCRIPT) {
      task.script_arguments = updates.task_arguments
    }

    task.save(function (err, task) {
      if (err) {
        if (err.name=='ValidationError') {
          err.statusCode = 400
        }
        return options.fail(err)
      }

      createTags(task.tags, task.customer)

      logger.log('publishing task')
      self.populate(task, function(err,pub){
        let reportName
        if (task.name != updates.name) {
          reportName = `${task.name} > ${updates.name}`
        } else  {
          reportName = task.name
        }
        done(pub)
      })
    })
  },
  /**
   *
   * @author Facundo
   *
   */
  fetchBy (filter,next) {
    const self = this
    FetchBy.call(Task, filter, function (err, tasks) {
      if (err) { return next(err) }
      if (tasks.length===0) { return next(null, tasks) }

      asyncMap(
        tasks,
        (task, callback) => { self.populate(task, callback) },
        (err, published) => { next(err, published) }
      )
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
    const self = this
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

    let data = lodashAssign({}, templateData, {
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

    self.create(data, (err,task) => {
      done(err, task)
    })
  },
  /**
   * @author Facugon
   * @summary Create a task
   * @param {Object} input
   * @property {Customer} input.customer
   * @property {User} input.user
   * @property {Host} input.host
   * @property {TaskTemplate} input.template
   * @param {Function(Error,)} done
   */
  create (input, done) {
    const self = this
    const customer = input.customer
    const user = input.user

    const created = (task) => {
      logger.log('task type "%s" created', task.type)
      logger.data('%j', task)
      return done(null, task)
    }

    logger.log('creating task with data %o', input)

    try {
      var task = TaskFactory.create(input)
    } catch (e) {
      return done(e)
    }

    // keep backward compatibility with script_arguments
    if (task.type===TaskConstants.TYPE_SCRIPT) {
      task.script_arguments = input.task_arguments
    }

    task.save(err => {
      if (err) {
        logger.error(err)
        return done(err)
      }
      createTags(input.tags, customer)
      createTaskEvents(task, customer)
      created(task)
    })
  },
  populateAll (tasks, next) {
    var result = []
    if (!Array.isArray(tasks)||tasks.length===0) {
      return next(null,result)
    }

    const populated = lodashAfter(tasks.length,() => next(null, result))

    for (var i=0; i<tasks.length; i++) {
      const task = tasks[i]
      this.populate(task,() => {
        result.push(task)
        populated()
      })
    }
  },
  populate (task, done) {
    const data = task.toObject()

    // only if host_id is set
    const populateHost = (next) => {
      let id = task.host_id
      if (!id) return next()
      Host.findById(id, (err, host) => {
        if (err) return next(err)
        if (!host) return next()
        data.host = host
        data.hostname = host.hostname
        next()
      })
    }

    // only task type script, and if script_id is set
    const populateScript = (next) => {
      let id = task.script_id
      if (!id) { return next() }
      Script.findById(id, (err,script) => {
        if (err) { return next(err) }
        if (!script) { return next() }
        data.script = script
        data.script_id = script._id
        data.script_name = script.filename
        next()
      })
    }

    const populateRunningJob = (next) => {

      const publish = (job) => {
        let data = {
          state: job.state,
          lifecycle: job.lifecycle,
          creation_date: job.creation_date,
          id: job._id.toString(),
          name: job.name,
          type: job.type,
          _type: job._type,
        }

        if (job.user) {
          data.user = {
            id: job.user._id.toString(),
            username: job.user.username,
            email: job.user.email
          }
        }

        return data
      }

      const populateLastJob = () => {
        Job
          .findOne({
            task_id: task._id.toString()
          })
          .sort({ creation_date: -1 })
          .populate('user')
          .exec((err, job) => {
            if (err) { return next(err) }
            if (!job) { return next() }
            data.jobs = [publish(job)]
            return next()
          })
      }

      data.jobs = []
      Job
        .find({
          task_id: task._id.toString(),
          $or: [
            { lifecycle: LifecycleConstants.READY },
            { lifecycle: LifecycleConstants.ASSIGNED },
            { lifecycle: LifecycleConstants.ONHOLD }
          ]
        })
        .sort({ creation_date: -1 })
        .populate('user')
        .exec((err, jobs) => {
          if (err) { return next(err) }
          if (jobs.length===0) {
            return populateLastJob()
          } else {
            data.jobs = jobs.map(job => publish(job))
            return next()
          }
        })
    }

    const populateSchedules = (next) => {
      App.scheduler.getTaskSchedule(task._id, (err, schedules) => {
        if (err) {
          return next(err)
        } else {
          data.schedules = schedules
          next(null, schedules)
        }
      })
    }

    asyncMap([
      populateHost,
      populateScript,
      populateRunningJob,
      populateSchedules
    ], (populate,callback) => {
      populate(callback)
    }, err => {
      return done(err, data)
    })
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
        data.user_id = user._id
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
