const logger = require('../lib/logger')('service:task');
const async = require('async');
const lodash = require('lodash');
const config = require('config');

var Tag = require('../entity/tag').Entity;
var Host = require('../entity/host').Entity;
var Task = require('../entity/task').Entity;
var ScraperTask = require('../entity/task/scraper').Entity;
var Script = require('../entity/file').Script;

const ScriptTaskTemplate = require('../entity/task/template').ScriptTemplate
const ScraperTaskTemplate = require('../entity/task/template').ScraperTemplate

var TaskEvent = require('../entity/event').TaskEvent;

// var filter = require('../router/param-filter');
var elastic = require('../lib/elastic')
var FetchBy = require('../lib/fetch-by')
var SchedulerService = require('./scheduler')

const registerTaskCRUDOperation = (customer,data) => {
  const key = config.elasticsearch.keys.task.crud
  elastic.submit(customer,key,data)
}

const TaskService = {
  remove (options) {
    var task = options.task;
    Task.remove({ _id: task._id }, err => {
      if(err) return options.fail(err);

      SchedulerService.unscheduleTask(task);

      TaskEvent.remove({ emitter_id: task._id }, err => {
        if(err) return options.fail(err);

        registerTaskCRUDOperation(
          options.customer.name, {
            name: options.task.name,
            customer_name: options.customer.name,
            user_id: options.user.id,
            user_email: options.user.email,
            operation: 'delete'
          }
        )
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

    task.update(updates, (error) => {
      if (error) {
        return options.fail(error)
      } else {
        logger.log('publishing task')
        self.populate(task, function(err,pub){
          registerTaskCRUDOperation(options.customer.name,{
            name: task.name,
            customer_name: options.customer.name,
            user_id: options.user.id,
            user_email: options.user.email,
            operation: 'update'
          })
          done(pub)
        })
      }
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

      var publishedTasks = [];
      var asyncTasks = [];
      tasks.forEach(function(task){
        asyncTasks.push(function(callback){
          self.populate(task,function(err, data){
            publishedTasks.push(data);
            callback();
          });
        });
      });

      async.parallel(asyncTasks,function(){
        next(null, publishedTasks);
      });
    });
  },
  /**
   *
   * @param {Object} input
   * @param {Function} next
   *
   */
  createManyTasks (input, next) {
    var create = []
    logger.log('creating tasks')

    function asyncTaskCreation (hostId) {
      return (function(asyncCb){
        if( hostId.match(/^[a-fA-F0-9]{24}$/) ) {
          Host.findById(hostId, function(error, host){
            if (error) return asyncCb(error)
            if (!host) return asyncCb(new Error('not found host id ' + hostId))

            const data = lodash.extend({}, input, {
              host: host,
              host_id: host._id,
              customer_id: input.customer._id,
              customer: input.customer._id,
              user_id: input.user._id
            })

            TaskService.create(data, (err,task) => {
              // turn task object into plain object, populate subdocuments
              TaskService.populate(task, asyncCb)
            })
          })
        } else {
          asyncCb(new Error('invalid host id ' + hostId), null)
        }
      })
    }

    var hosts = input.hosts
    logger.log('creating task on hosts %j', hosts)
    for (var i in hosts) {
      var hostId = hosts[i]
      create.push( asyncTaskCreation(hostId) )
    }

    async.parallel(create, next);
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

    data = lodash.assign({}, template.toObject(), {
      customer_id: customer._id,
      customer: customer,
      host: host,
      host_id: host._id,
      template_id: template._id,
      template: template,
      _type: 'Task'
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
   * @param {Customer} input.customer
   * @param {User} input.user
   * @param {Host} input.host
   * @param {TaskTemplate} input.template
   * @param {Function(Error,)} done
   */
  create (input, done) {
    const self = this
    const customer = input.customer
    const user = input.user

    const created = (task) => {
      logger.log('creating task type "%s"', task.type)
      logger.data('%j', task)

      registerTaskCRUDOperation(customer.name,{
        name: task.name,
        customer_name: customer.name,
        user_id: (user && user.id) || null,
        user_email: (user && user.email) || null,
        operation: 'create'
      })

      //self.populate(task, done)
      return done(null,task)
    }

    logger.log('creating task with data %o', input)

    var task;
    if (input.type == 'scraper') {
      task = new ScraperTask(input)
    } else {
      task = new Task(input)
    }

    task.save(err => {
      if (err) {
        logger.error(err)
        return done(err)
      }
      created(task);

      if (input.tags && Array.isArray(input.tags)) {
        Tag.create(input.tags, customer)
      }

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
    })
  },
  populateAll (tasks, next) {
    var result = []
    if (!Array.isArray(tasks)||tasks.length===0) {
      return next(null,result)
    }

    const populated = lodash.after(tasks.length,() => next(null, result))

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
    const populateHost = (id, next) => {
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
    const populateScript = (id, next) => {
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

    populateHost(task.host_id, (err) => {
      if (err) return done(err)
      populateScript(task.script_id, (err) => {
        return done(err,data)
      })
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

  async.map(
    tasks,
    (task, next) => {
      var template
      var data

      if (Object.keys(task).length === 0) {
        const err = new Error('invalid task definition');
        err.statusCode = 400;
        return next(err)
      }

      data = Object.assign({},task)
      data.hostgroup_id = hostgroup._id
      data.hostgroup = hostgroup
      data.customer_id = customer._id
      data.customer = customer
      data.user_id = user._id
      data.user = user
      data.source_model_id = data.id || data._id

      if (data._id) delete data._id // must be autogenerated
      if (data.secret) delete data.secret // autogenerate too

      logger.log('creating task template')
      logger.data('%j',data)

      if (task.type === 'scraper') {
        template = new ScraperTaskTemplate(data)
      } else {
        data.script = data.script_id
        template = new ScriptTaskTemplate(data)
      }

      template.save(err => {
        if (err) {
          logger.err(err)
          return next(err)
        }
        logger.log('task template %s created', template._id)
        next(err,template)
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
