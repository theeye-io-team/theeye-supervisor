var Agenda = require("agenda");
var config = require("config");
var logger = require("./logger")("eye:supervisor:lib:scheduler");
var mongodb = require('./mongodb').connection.db;
var async = require('async');
var Host = require("../entity/host").Entity;
var Task = require("../entity/task").Entity;
var Script = require("../entity/script").Entity;
var Customer = require("../entity/customer").Entity;
var User = require("../entity/user").Entity;
var JobService = require("../service/job");
var format = require('util').format;
var ObjectID = require('mongodb').ObjectID;

function Scheduler() {
  logger.log('Initialize');
  // var messages = db.get("messages");
  var _this = this;

  // use the default mongodb connection
  this.agenda = new Agenda({
    mongo: mongodb,
    defaultConcurrency: 50,
    maxConcurrency: 200
  });

  this.agenda.on('ready', function(){
    logger.log('scheduler is ready');
    // _this.agenda._db.ensureIndex("nextRunAt", ignoreErrors)
    //   .ensureIndex("lockedAt", ignoreErrors)
    //   .ensureIndex("name", ignoreErrors)
    //   .ensureIndex("priority", ignoreErrors);

    // Define the job
    _this.agenda.define("task", function(job, done) {
      logger.log('Called task job');
      _this.taskProcessor(job, done);
    });
    _this.agenda.on('start', function(job) {
      logger.log('EVENT: start');
      logger.log("Job %s starting", job.attrs.name);
    });
    _this.agenda.on('error', function(err, job) {
      logger.log('EVENT: error');
      logger.log("Job %s failed with: %j", job.name, err.stack);
    });
    _this.agenda.on('fail', function(err, job) {
      logger.log('EVENT: fail');
      logger.log("Job %s failed with: %j", job.name, err.stack);
    });

    // Unlock agenda events when process finishes
    function graceful() {
      logger.log('SIGTERM/SIGINT agenda graceful stop');
      _this.agenda.stop(function() {});
      // process.exit(0);
    }

    process.on('SIGTERM', graceful);
    process.on('SIGINT', graceful);
  });

  this.agenda.start();
}

Scheduler.prototype = {
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
    // var _this = this;

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
        {_id: new ObjectID(scheduleId)}
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
      if(failed) {
        return done();
      }

      //ok, let's do it...
      // console.log(data);

      JobService.create({
        task: data.task,
        user: data.user,
        customer: data.customer,
        notify: true
      },(error,job)=>{});
    });
  }
};

function Module () {
  this.scheduler;
}

Module.prototype.initialize = function(callback) {
  this.scheduler = new Scheduler();
  callback(this.scheduler);
};

Module.prototype.getInstance = function() {
  return this.scheduler;
};

var instance = new Module();
module.exports = instance;
