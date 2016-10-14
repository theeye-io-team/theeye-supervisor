var Agenda = require('agenda');
var config = require('config');
var async = require('async');
var format = require('util').format;
var ObjectId = require('mongoose').Types.ObjectId;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var logger = require('../lib/logger')(':scheduler');
var mongodb = require('../lib/mongodb').connection.db;
var Host = require('../entity/host').Entity;
var Task = require('../entity/task').Entity;
var Script = require('../entity/script').Entity;
var Customer = require('../entity/customer').Entity;
var User = require('../entity/user').Entity;
var JobDispatcher = require('./job');

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
  setupAgenda: function(){
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
  initialize: function(ready) {
    var self = this;
    this.agenda.on('ready', function(){
      logger.log('scheduler is ready');
      ready();
      self.setupAgenda();
    });
    this.agenda.start();
  },
  /**
   * schedules a task
   * @param {Object} task data.
   */
  scheduleTask: function(input, done) {
    var task = input.task,
      customer = input.customer,
      user = input.user,
      schedule = input.schedule;

    var data = {
      task_id : task._id ,
      host_id : task.host_id ,
      script_id : task.script_id ,
      script_arguments : task.script_arguments ,
      name : task.name ,
      user_id : user._id ,
      customer_id : customer._id ,
      customer_name : customer.name ,
      state : 'new' ,
      notify : input.notify ,
      scheduleData : schedule ,
    };

    // runDate is milliseconds
    var date = new Date(schedule.runDate);
    var frequency = schedule.repeatEvery || false;
    this.schedule(date,"task",data,frequency,done);
  },
  /**
   * Schedules a job for its starting date and parsing its properties
   */
  schedule: function(starting, jobName, data, interval, done) {
    // var self = this;
    var agendaJob = this.agenda.create(jobName, data);

    agendaJob.schedule(starting);
    logger.log("agendaJob.schedule %s", starting);
    if (interval) {
      logger.log("repeatEvery %s", interval);
      agendaJob.repeatEvery(interval);
    }
    agendaJob.save(done);
  },
  getTaskScheduleData: function(oid, callback) {
    if(!oid) {
      return callback(new Error('task id must be provided'));
    }
    this.agenda.jobs(
      {
        $and:[
          {name: 'task'},
          {'data.task_id': oid}
        ]
      },
      callback);
  },
  cancelTaskSchedule: function(taskId, scheduleId, callback) {
    if(!scheduleId) {
      return callback(new Error('schedule id must be provided'));
    }
    // la verdad es que con el schedule id alcanza
    this.agenda.cancel({
      $and:[
        {name: 'task'},
        {_id: new ObjectId(scheduleId)}
      ]
    }, callback);
  },
  taskProcessor: function(agendaJob, done) {
    logger.log('////////////////////////////////////////');
    logger.log('////////////////////////////////////////');
    logger.log('Called agendaJob processor taskProcessor');
    logger.log('////////////////////////////////////////');
    logger.log('////////////////////////////////////////');

    var jobData = agendaJob.attrs.data;

    function JobError (err){
      agendaJob.fail(err);
      agendaJob.save();
      done(err);
    }

    async.parallel({
      customer: (callback) => Customer.findById(jobData.customer_id, callback) ,
      task: (callback) => Task.findById(jobData.task_id, callback) ,
      host: (callback) => Host.findById(jobData.host_id, callback) ,
      user: (callback) => User.findById(jobData.user_id, callback) ,
      script: (callback) => Script.findById(jobData.script_id, callback)
    }, function(err, data) {
      if(err) return new JobError(err);

      var failed = false;
      Object.keys(data).every(function(k,i){
        //if any member isn't here: fail and done.
        if(!data[k]) {
          failed = true;
          agendaJob.fail(k + ' (' + jobData[k+'_id'] +') is missing');
          agendaJob.save();
          return false;
        }
        return true;
      });

      if(failed) return done();

      JobDispatcher.create({
        task: data.task,
        user: data.user,
        customer: data.customer,
        notify: true
      },(err,job)=>{
        if(err) return new JobError(err);
        done();
      });
    });
  }
};

module.exports = new Scheduler();
