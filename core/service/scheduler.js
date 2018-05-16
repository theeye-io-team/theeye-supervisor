'use strict'

const Agenda = require('agenda')
const async = require('async')
const ObjectId = require('mongoose').Types.ObjectId
const EventEmitter = require('events').EventEmitter
const util = require('util')

const App = require('../app')

// var config = require('config');
// var format = require('util').format;

var logger = require('../lib/logger')(':scheduler');
var mongodb = require('../lib/mongodb').connection.db;
var Host = require('../entity/host').Entity;
var Task = require('../entity/task').Entity;
var Script = require('../entity/file').Script;
var Customer = require('../entity/customer').Entity;
var User = require('../entity/user').Entity;
var Workflow = require('../entity/workflow').Workflow;

const JobConstants = require('../constants/jobs')
const LifecycleConstants = require('../constants/lifecycle')

const JobDispatcher = require('../service/job')

function Scheduler() {
  EventEmitter.call(this);

  // use the default mongodb connection
  this.agenda = new Agenda({
    mongo: mongodb,
    defaultConcurrency: 50,
    maxConcurrency: 200
  });
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
   * @property {Workflow} input.workflow to which workflow this job belongs, or undefined
   * @property {String[]} input.script_arguments
   */
  scheduleTask (input, done) {
    const task = input.task
    const workflow = input.workflow
    const customer = input.customer
    const user = input.user
    const schedule = input.schedule

    const data = {
      event: input.event,
      event_data: input.event_data,
      task_id: task._id,
      task_id: task._id,
      host_id: task.host_id,
      script_id: task.script_id,
      workflow_id: workflow._id,
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
      if (err) return done(err)
      done(null,job)
      // If everything went well, ensure 'scheduled' tag on the task
      this.tagThatTask(task,() => {})
    })
  },
  /*
  * Given a task, this method will ensure it has a 'scheduled' tag
  */
  tagThatTask (task, callback) {
    var tags = [].concat(task.tags);

    if (tags.indexOf("scheduled") === -1) {
      tags.push("scheduled");
      task.update({tags:tags}, callback);
    } else {
      callback();
    }
  },
  // When untaggin we only got ID, find and check
  untagTask (task, callback) {
    var tags = [].concat(task.tags);

    if(tags.indexOf("scheduled") !== -1) {
      tags.splice(tags.indexOf("scheduled"),1);
      task.update({tags:tags}, callback);
    }else{
      callback();
    }
  },
  handleScheduledTag (task, callback) {
    if(!task) {
      var err = new Error('Missing task');
      err.statusCode = 400;
      return callback(err);
    }

    var self = this;
    this.taskSchedulesCount(task, function (err, count) {
      if (err) return callback(err);
      if (count) { //has schedules
        self.tagThatTask(task, callback);
      } else {
        self.untagTask(task, callback);
      }
    });
  },
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
      self.handleScheduledTag(task,function(){});
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

    var jobData = agendaJob.attrs.data;

    function JobError (err) {
      agendaJob.fail(err)
      agendaJob.save()
      return done(err)
    }

    async.parallel({
      customer: callback => Customer.findById(jobData.customer_id, callback),
      task: callback => Task.findById(jobData.task_id, callback),
      host: callback => Host.findById(jobData.host_id, callback),
      user: callback => User.findById(jobData.user_id, callback),
      workflow: callback => Workflow.findById(jobData.workflow_id, callback),
    }, function (err, data) {
      const task = data.task

      if (err) return new JobError(err)
      if (!data.customer) return new JobError( new Error('customer %s is no longer available', jobData.customer_id) )
      if (!data.workflow) return new JobError( new Error('workflow %s is no longer available', jobData.workflow_id) )
      if (!data.task) return new JobError( new Error('task %s is no longer available', jobData.task_id) )
      if (!data.host) return new JobError( new Error('host %s is no longer available', jobData.host_id) )
      if (!data.user) return new JobError( new Error('user %s is no longer available', jobData.user_id) )

      JobDispatcher.create({
        event: jobData.event,
        event_data: jobData.event_data,
        task: data.task,
        workflow: data.workflow,
        user: data.user,
        customer: data.customer,
        notify: true,
        origin: JobConstants.ORIGIN_SCHEDULER
      }, (err,job) => {
        if (err) return new JobError(err)
        done()
      })
    })
  }
}

module.exports = new Scheduler();
