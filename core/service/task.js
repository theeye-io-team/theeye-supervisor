'use strict'

const App = require('../app')

const isMongoId = require('validator/lib/isMongoId')
const logger = require('../lib/logger')('service:task')
const asyncMap = require('async/map')

const lodashAssign = require('lodash/assign')
const lodashAfter = require('lodash/after')
const lodashExtend = require('lodash/extend')

const config = require('config')
const Tag = require('../entity/tag').Entity
const Host = require('../entity/host').Entity
const Task = require('../entity/task').Entity
const TaskFactory = require('../entity/task').Factory
const TaskEvent = require('../entity/event').TaskEvent
const Script = require('../entity/file').Script
const Job = require('../entity/job').Job
const CONSTANTS = require('../constants')

const ScriptTaskTemplate = require('../entity/task/template').ScriptTemplate
const ScraperTaskTemplate = require('../entity/task/template').ScraperTemplate

// var filter = require('../router/param-filter');
const elastic = require('../lib/elastic')
var FetchBy = require('../lib/fetch-by')

const TaskService = {
  /**
   * @summary Remove task
   * @param {Object} options
   * @property {Task} options.task
   * @property {Function} options.fail failure function
   * @property {Function} options.done success function
   */
  remove (options) {
    const task = options.task
    Task
      .find({ _id: task._id })
      .remove()
      .exec(err => {
        if (err) return options.fail(err)

        App.scheduler.unscheduleTask(task)

        TaskEvent
          .find({ emitter_id: task._id })
          .remove()
          .exec(err => {

            if (err) return options.fail(err)

          })

        options.done()
      })
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
    task.save(function (err, task) {
      if (err) {
        if (err.name=='ValidationError') {
          err.statusCode = 400
        }
        return options.fail(err)
      }

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
    FetchBy.call(Task,filter,function(err,tasks){
      if (err) return next(err);
      if (tasks.length===0) return next(null,tasks);

      asyncMap(
        tasks,
        (task, callback) => {
          self.populate(task, callback)
        },
        (err, published) => {
          next(err, published)
        }
      )
    })
  },
  /**
   *
   * @param {Object} input
   * @param {Function} next
   *
   */
  createManyTasks (input, next) {
    const hosts = input.hosts
    logger.log('creating tasks')
    asyncMap( hosts, (hostId, done) => {
      if (isMongoId(hostId)) {
        logger.log('creating task on hosts %j', hosts)
        Host.findById(hostId, function(error, host){
          if (error) return done(error)
          if (!host) return done(new Error('not found host id ' + hostId))

          const data = lodashExtend({}, input, {
            host: host,
            host_id: host._id,
            customer_id: input.customer._id,
            customer: input.customer._id,
            user_id: input.user._id
          })

          TaskService.create(data, (err,task) => {

            /**
             * @todo submit here instead of using lib/audit middleware because
             * audit middleware cannot be used with bulk creation
             */
            const topic = config.notifications.topics.task.crud
            elastic.submit(input.customer.name, topic, { // topic = config.notifications.topics.task.crud , BULK CREATE
              hostname: task.hostname || 'undefined',
              model_id: task._id,
              model_name: task.name,
              model_type: task._type,
              organization: input.customer.name,
              user_id: input.user._id,
              user_name: input.user.username,
              user_email: input.user.email,
              operation: CONSTANTS.CREATE
            })

            // turn task object into plain object, populate subdocuments
            TaskService.populate(task, done)
          })
        })
      } else {
        done(new Error('invalid host id ' + hostId), null)
      }
    }, (err, tasks) => {
      next(err, tasks)
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
    const host = options.host
    const done = options.done || (() => {})
    var data

    logger.log('creating task from template %j', template);

    data = lodashAssign({}, template.toObject(), {
      customer_id: customer._id,
      customer: customer,
      host: host,
      host_id: host._id,
      template_id: template._id,
      template: template,
      _type: template._type // force _type
    })

    delete data._id
    delete data.id
    delete data.user_id

    self.create(data,(err,task) => {
      //self.populate(task,done)
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
      return done(null,task)
    }
    const createTaskEvents = (task) => {
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
        (err) => {
          if (err) {
            logger.error(err)
          }
        }
      )
    }
    const createTags = (tags) => {
      if (tags && Array.isArray(tags)) {
        Tag.create(tags, customer)
      }
    }

    logger.log('creating task with data %o', input)

    var task = TaskFactory.create(input)

    task.save(err => {
      if (err) {
        logger.error(err)
        return done(err)
      }
      createTags(input.tags)
      createTaskEvents(task)
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
      if (!id) return next()
      Script.findById(id, (err,script) => {
        if (err) return next(err)
        if (!script) return next()
        data.script = script
        data.script_id = script._id
        data.script_name = script.filename
        next()
      })
    }

    const populateLastJob = (next) => {
      Job
        .findOne({
          task_id: task._id,
          host_id: task.host_id
        })
        .sort({ creation_date: -1 })
        .populate('user')
        .exec((err,last) => {
          if (err) return next(err)

          if (!last) {
            data.lastjob_id = null
            data.lastjob = null
          } else {
            data.lastjob_id = last._id
            data.lastjob = last
          }

          return next()
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
      populateLastJob,
      populateSchedules
    ], (populate,callback) => {
      populate(callback)
    }, err => {
      return done(err, data)
    })
  }
}

module.exports = TaskService

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
TaskService.createTemplates = (hostgroup, tasks, customer, user, done) => {
  if (!tasks) return done(null,[])
  if (!Array.isArray(tasks) || tasks.length == 0) return done(null,[])

  logger.log('processing %s tasks', tasks.length)

  const createTemplateEntity = (data, next) => {
    logger.log('creating task template')
    logger.data('%j', data)

    let template
    if (data.type === 'scraper') {
      template = new ScraperTaskTemplate(data)
    } else {
      data.script = data.script_id
      template = new ScriptTaskTemplate(data)
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

      let data = Object.assign({},task)
      data.hostgroup_id = hostgroup._id
      data.hostgroup = hostgroup
      data.customer_id = customer._id
      data.customer = customer
      data.user_id = user._id
      data.user = user
      data.source_model_id = data.id || data._id
      data.triggers = task.triggers || []
      if (data._id) delete data._id // must be autogenerated
      if (data.secret) delete data.secret // autogenerate too

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
}

/**
 * Create a template from task properties.
 * @author Facundo
 */
const taskToTemplate = (id, next) => {
  Task.findById( id , function(error, task){
    if(error) throw new Error(error);

    if(!task) {
      var e = new Error('task not found. invalid task id');
      e.statusCode = 400;
      return next(e);
    }

    task.toTemplate(next);
  });
}
