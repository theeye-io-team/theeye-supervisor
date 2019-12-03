'use strict'

const Agenda = require('agenda')
const async = require('async')
const ObjectId = require('mongoose').Types.ObjectId
const EventEmitter = require('events').EventEmitter
const util = require('util')

const App = require('../app')

// var config = require('config');
// var format = require('util').format;

const logger = require('../lib/logger')(':scheduler')
const mongodb = require('../lib/mongodb').connection.db
const Host = require('../entity/host').Entity
const Task = require('../entity/task').Entity
const Script = require('../entity/file').Script
const Customer = require('../entity/customer').Entity
const User = require('../entity/user').Entity

const JobConstants = require('../constants/jobs')
const LifecycleConstants = require('../constants/lifecycle')

function Scheduler () {
  EventEmitter.call(this)

  // use the default mongodb connection
  this.agenda = new Agenda({
    mongo: mongodb,
    defaultConcurrency: 50,
    maxConcurrency: 200
  })
}

// give the scheduler the hability to emit events
util.inherits(Scheduler, EventEmitter);

Scheduler.prototype = {
  initialize (ready) {
    var self = this;
    this.agenda.on('ready', function(){
      logger.log('scheduler is ready');
      ready();
      self.setupAgenda();
    });
    this.agenda.start();
  },
  setupAgenda () {
    var self = this;
    var agenda = this.agenda;

    agenda.define('task', function(job, done) {
      logger.log('Called task job');
      self.taskProcessor(job, done);
    });

    agenda.on('start', function(job) {
      logger.log('job %s started', job.attrs.name);
    });

    agenda.on('complete', function(job) {
      logger.log('job %s completed', job.attrs.name);
      //TODO nice place to check for schedules and ensure tag
    });

    agenda.on('error', function(err, job) {
      logger.log('job %s error %j', job.name, err.stack);
    });

    agenda.on('fail', function(err, job) {
      logger.log('job %s failed %j', job.name, err.stack);
    });

    // Unlock agenda events when process finishes
    function graceful() {
      logger.log('SIGTERM/SIGINT agenda graceful stop');
      agenda.stop(function(){});
      // process.exit(0);
    }

    process.on('SIGTERM', graceful);
    process.on('SIGINT', graceful);
  },
  /**
   * schedules a task
   * @param {Object} input data
   * @property {String} input.origin job schedule creator
   * @property {Task} input.task the task definition
   */
  scheduleTask (input, done) {
    const task = input.task
    const customer = input.customer
    const user = input.user
    const schedule = input.schedule

    const data = {
      task_id: task._id,
      name: task.name,
      user_id: App.user._id,
      customer_id: customer._id,
      customer_name: customer.name,
      lifecycle: LifecycleConstants.READY,
      notify: input.notify || false,
      scheduleData: schedule,
      origin: input.origin
    }

    // runDate is miliseconds
    var date = new Date(schedule.runDate)
    var frequency = schedule.repeatEvery || false

    this.schedule(date, "task", data, frequency, (err,job) => {
      if (err) { return done(err) }
      done(null,job)
    })
  },
  /*
  * Given a task, this method will ensure it has a 'scheduled' tag
  */
  //tagThatTask (task, callback) {
  //  var tags = [].concat(task.tags);
  //  if (tags.indexOf("scheduled") === -1) {
  //    tags.push("scheduled");
  //    task.update({tags:tags}, callback);
  //  } else {
  //    callback();
  //  }
  //},
  // When untaggin we only got ID, find and check
  //untagTask (task, callback) {
  //  var tags = [].concat(task.tags);
  //  if(tags.indexOf("scheduled") !== -1) {
  //    tags.splice(tags.indexOf("scheduled"),1);
  //    task.update({tags:tags}, callback);
  //  }else{
  //    callback();
  //  }
  //},
  //handleScheduledTag (task, callback) {
  //  if(!task) {
  //    var err = new Error('Missing task');
  //    err.statusCode = 400;
  //    return callback(err);
  //  }
  //  var self = this;
  //  this.taskSchedulesCount(task, function (err, count) {
  //    if (err) return callback(err);
  //    if (count) { //has schedules
  //      self.tagThatTask(task, callback);
  //    } else {
  //      self.untagTask(task, callback);
  //    }
  //  });
  //},
  /**
   * Schedules a job for its starting date and parsing its properties
   */
  schedule (starting, jobName, data, interval, done) {
    var agendaJob = this.agenda.create(jobName, data);
    agendaJob.schedule(starting);
    logger.log("agendaJob.schedule %s", starting);
    if (interval) {
      logger.log("repeatEvery %s", interval);
      agendaJob.repeatEvery(interval);
    }
    agendaJob.save(done);
  },
  getTaskSchedule (taskId, callback) {
    if (!taskId) return callback(new Error('task id required'))

    this.agenda.jobs({
      $and:[
        {name: 'task'},
        {'data.task_id': taskId},
        {nextRunAt: {$ne: null}}
      ]
    }, callback)
  },
  // searches for task jobs of a given customer id
  // TODO method naming could be improved if it's not gonna be a generic getter
  getSchedules (cid, callback) {
    if (!cid) {
      return callback(new Error('user id must be provided'));
    }

    this.agenda.jobs({
      $and:[
        {name: 'task'},
        {'data.customer_id': cid}
      ]
    }, callback)
  },
  // Counts schedules for the given task
  // @param callback: Function (err, schedulesCount)
  taskSchedulesCount (task, callback) {
    this.getTaskSchedule(task._id, function(err, schedules){
      return callback(err, err ? 0 : schedules.length);
    });
  },
  //Cancels a specific scheduleId. Task is provided for further processing
  cancelTaskSchedule (task, scheduleId, callback) {
    if(!scheduleId) return callback(new Error('schedule id must be provided'));

    var self = this;
    // la verdad es que con el schedule id alcanza
    this.agenda.cancel({
      $and:[
        {name: 'task'},
        {_id: new ObjectId(scheduleId)}
      ]
    }, function(err, numRemoved){
      if(err) return callback(err);
      callback();
      // numRemoved is lost through the callbacks, don't count on it
      //self.handleScheduledTag(task,function(){});
    });
  },
  // deletes ALL schedules for a given task
  unscheduleTask (task, callback) {
    this.agenda.cancel({
      $and: [
        { name: 'task' },
        { "data.task_id": task._id }
      ]
    }, callback);
  },
  taskProcessor (agendaJob, done) {
    logger.log('//////////////////////////////////////////')
    logger.log('//////////////////////////////////////////')
    logger.log(' Called agendaJob processor taskProcessor ')
    logger.log('//////////////////////////////////////////')
    logger.log('//////////////////////////////////////////')

    var jobData = agendaJob.attrs.data

    function JobError (err) {
      agendaJob.fail(err)
      agendaJob.save()
      return done(err)
    }

    Task.findById(jobData.task_id, (err, task) => {
      if (err) { return new JobError(err) }
      if (!task) {
        let err = new Error('task %s is no longer available', jobData.task_id)
        return new JobError(err)
      }

      verifyTask(task, (err, data) => {
        if (err) { return new JobError(err) }
        App.jobDispatcher.create({
          task,
          user: App.user,
          customer: data.customer,
          notify: true,
          origin: JobConstants.ORIGIN_SCHEDULER
        }, (err, job) => {
          if (err) { return new JobError(err) }
          done()
        })
      })
    })
  }
}

const verifyTask = (task, done) => {
  async.parallel({
    customer: callback => Customer.findById(task.customer_id, callback),
    host: callback => Host.findById(task.host_id, callback),
    script: callback => {
      if (task.type === 'script') {
        Script.findById(task.script_id, callback)
      } else {
        callback()
      }
    }
  }, (err, data) => {
    if (err) { return done(err) }

    if (!data.customer) {
      let err = new Error('customer ' + task.customer_id + ' is no longer available')
      return done(err)
    }

    if (!data.host) {
      let err = new Error('host ' + task.host_id + ' is no longer available')
      return done(err)
    }

    if (task.type==='script' && !data.script) {
      let err = new Error('script ' + task.script_id + ' is no longer available')
      return done(err)
    }

    return done(null, data)
  })
}

module.exports = new Scheduler()
