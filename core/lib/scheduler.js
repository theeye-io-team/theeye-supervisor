var Agenda = require("agenda");
var config = require("config");
var debug = require("debug")("eye:supervisor:lib:scheduler");
// var db = require('./mongodb').db;
var async = require('async');

var Host = require("../entity/host").Entity;
var Task = require("../entity/task").Entity;
var Script = require("../entity/script").Entity;
var Customer = require("../entity/customer").Entity;
var User = require("../entity/user").Entity;
var Job = require("../entity/job").Entity;


// var monk = require("monk");
// var db = monk(config.get("mongodb").url);
// var request = require('request');

module.exports = Scheduler;

function Scheduler(app) {
  if (!(this instanceof Scheduler)) {
    return new Scheduler(app);
  }

  debug('Initialize');
  // var messages = db.get("messages");
  var _this = this;
  app.scheduler = this;

  var mongo = config.get('mongo');
  var mongoConnectionString = mongo.hosts + ":" + mongo.port + "/" + mongo.database;
  this.app = app;
  this.agenda = new Agenda({
    db: {
      address: mongoConnectionString
    },
    defaultConcurrency: 50,
    maxConcurrency: 200
  });
  // this.agenda.mongo(db.collection('agendaJobs').conn.db);
  // this.agenda.mongo();

  // function ignoreErrors() {}

  this.agenda.on('ready', function(){
    // _this.agenda._db.ensureIndex("nextRunAt", ignoreErrors)
    //   .ensureIndex("lockedAt", ignoreErrors)
    //   .ensureIndex("name", ignoreErrors)
    //   .ensureIndex("priority", ignoreErrors);

    // Define the job
    _this.agenda.define("task", function(job, done) {
      debug('Called task job');
      _this.taskProcessor(job, done);
    });
    _this.agenda.on('start', function(job) {
      debug('EVENT: start');
      debug("Job %s starting", job.attrs.name);
    });
    _this.agenda.on('error', function(err, job) {
      debug('EVENT: error');
      debug("Job %s failed with: %j", job.name, err.stack);
    });
    _this.agenda.on('fail', function(err, job) {
      debug('EVENT: fail');
      debug("Job %s failed with: %j", job.name, err.stack);
    });

    // Listen the event emitted when a new message is created on the DB.
    app.on("new_task_schedule", function(taskData) {
      debug('Called event new_task_schedule');
      _this.scheduleTask(taskData);
    });

    // Unlock agenda events when process finishes
    function graceful() {
      debug('SIGTERM/SIGINT agenda graceful stop');
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
    debug('scheduleTask');
    debug(taskData);

    var date = new Date(taskData.scheduleData.runDate);

    this.schedule(date, "task", taskData, false, done);
  },
  /**
   * Schedules a job for its starting date and parsing its properties
   */
  schedule: function(starting, jobName, data, interval, done) {
    // var _this = this;
    // var app = this.app;

    var agendaJob = this.agenda.create(jobName, data);

    agendaJob.schedule(starting);
    debug("agendaJob.schedule %s", starting);
    // if (interval) {
    //   debug("repeatEvery %s", interval);
    //   agendaJob.repeatEvery(interval);
    // }
    agendaJob.save(done);

  },
  taskProcessor: function(agendaJob, done) {
    debug('////////////////////////////////////////');
    debug('////////////////////////////////////////');
    debug('Called agendaJob processor taskProcessor');
    debug('////////////////////////////////////////');
    debug('////////////////////////////////////////');

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

      Job.create({
        task: data.task,
        user: data.user,
        customer: data.customer,
        notify: true
      },function(job) {
        job.publish(function(published){
          done();
        });
      });
    });
  }
};
