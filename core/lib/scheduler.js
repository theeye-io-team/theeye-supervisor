var Agenda = require('agenda');
var config = require('config');
var async = require('async');
var format = require('util').format;
var ObjectId = require('mongoose').Types.ObjectId;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var logger = require('./logger')('eye:supervisor:lib:scheduler');
var mongodb = require('./mongodb').connection.db;
var Host = require('../entity/host').Entity;
var Task = require('../entity/task').Entity;
var Script = require('../entity/script').Entity;
var Customer = require('../entity/customer').Entity;
var User = require('../entity/user').Entity;
var JobService = require('../service/job');

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
    // self.agenda._db.ensureIndex("nextRunAt", ignoreErrors)
    //   .ensureIndex("lockedAt", ignoreErrors)
    //   .ensureIndex("name", ignoreErrors)
    //   .ensureIndex("priority", ignoreErrors);

    // Define the job
    agenda.define("task", function(job, done) {
      logger.log('Called task job');
      self.taskProcessor(job, done);
    });
    agenda.on('start', function(job) {
      logger.log('EVENT: start');
      logger.log("Job %s starting", job.attrs.name);
    });
    agenda.on('error', function(err, job) {
      logger.log('EVENT: error');
      logger.log("Job %s failed with: %j", job.name, err.stack);
    });
    agenda.on('fail', function(err, job) {
      logger.log('EVENT: fail');
      logger.log("Job %s failed with: %j", job.name, err.stack);
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
  scheduleTask: function(taskData, done) {
    logger.log('scheduleTask');
    logger.log(taskData);

    var date = new Date(taskData.scheduleData.runDate);
    var frequency = taskData.scheduleData.repeatEvery || false;

    this.schedule(date, "task", taskData, frequency, done);
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

    // console.log(agendaJob.attrs);
    var jobData = agendaJob.attrs.data;

    async.parallel({
      task: function(callback) {
        Task.findById(jobData.task_id, callback);
      },
      host: function(callback) {
        Host.findById(jobData.host_id, callback);
      },
      customer: function(callback) {
        Customer.findById(jobData.customer_id, callback);
      },
      user: function(callback) {
        User.findById(jobData.user_id, callback);
      },
      script: function(callback) {
        Script.findById(jobData.script_id, callback);
      }
    }, function(err, data) {
      if(err) {
        agendaJob.fail(err);
        agendaJob.save();
        return false;
      }
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

      JobService.create({
        task: data.task,
        user: data.user,
        customer: data.customer,
        notify: true
      },(error,job)=>{});
    });
  }
};

module.exports = new Scheduler();
