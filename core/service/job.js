"use strict";

var Job = require('../entity/job').Job;
var ScriptJob = require('../entity/job').Script;
var ScraperJob = require('../entity/job').Scraper;
var Script = require('../entity/script').Entity;

var async = require('async');
var NotificationService = require('./notification');
var globalconfig = require('config');
var elastic = require('../lib/elastic');
var debug = require('../lib/logger')('eye:supervisor:service:job');

const JOB_UPDATE_AGENT_CONFIG = 'agent:config:update';
const STATUS_AGENT_UPDATED = 'agent-updated';
const STATUS_JOB_COMPLETED = 'job-completed';
const JOB_STATE_NEW = 'new';

function registerJobCreation(customer,data){
  var key = globalconfig.elasticsearch.keys.task.execution;
  elastic.submit(customer,key,data);
}

function createScriptJob(input, done){
  var task = input.task;
  var script_id = task.script_id;
  Script.findById(script_id).exec(function(error,script){
    var job = new ScriptJob();
    job.task = task.toObject(); // >>> add .id 
    job.script = script.toObject(); // >>> add .id 
    job.task_id = task._id;
    job.script_id = script._id;
    job.user = input.user;
    job.user_id = input.user._id;
    job.host_id = task.host_id ;
    job.host = task.host_id ;
    job.name = task.name;
    job.customer_id = input.customer._id;
    job.customer_name = input.customer.name;
    job.notify = input.notify;
    job.state = JOB_STATE_NEW;
    job.save(error => {
      if(error) return done(error);

      registerJobCreation(input.customer.name,{
        'customer_name': input.customer.name,
        'user_id': input.user.id,
        'user_email': input.user.email,
        'task_name': task.name,
        'task_type': task.type,
        'script_name': script.filename,
      });

      debug.log('script job created.');
      done(null, job);
    });
  });
}

function createScraperJob(input, done){
  var task = input.task;
  var job = new ScraperJob();
  job.task = task.toObject(); // >>> add .id 
  job.task_id = task._id;
  job.user = input.user;
  job.user_id = input.user._id;
  job.host_id = task.host_id ;
  job.host = task.host_id ;
  job.name = task.name;
  job.customer_id = input.customer._id;
  job.customer_name = input.customer.name;
  job.notify = input.notify;
  job.state = JOB_STATE_NEW;
  job.save(error => {
    if(error) return done(error);

    registerJobCreation(input.customer.name,{
      'customer_name': input.customer.name,
      'user_id': input.user.id,
      'user_email': input.user.email,
      'task_name': task.name,
      'task_type': task.type
    });

    debug.log('scraper job created.');
    done(null, job);
  });
}

var service = {
  /**
   * @author Facugon
   * @param {Object[
   *  Task task,
   *  User user,
   *  Customer customer,
   *  Boolean notify
   *  ]} input
   * @param {Function(error,job)} done
   */
  create (input,done) {
    var task = input.task;
    var type = task.type;

    if( type == 'script' ){
      createScriptJob(input, done);
    } else if( type == 'scraper' ){
      createScraperJob(input, done);
    } else {
      throw new Error('invalid or undefined task type ' + task.type);
    }
  },
  fetchBy(input,next) {
    var query = {};

    if( input.host ) query.host_id = input.host._id ;
    if( input.state ) query.state = input.state ;

    Job.find(query,function(error, jobs){
      next( jobs );
    });
  },
  getNextPendingJob(input,next) {
    var query = {};
    query.state = JOB_STATE_NEW;
    query.host_id = input.host._id;

    Job.findOne(query,function(error,job){
      if( job != null ) {
        job.state = "sent";
        job.save(error => {
          if(error) throw error;
          next(null,job);
        });
      }
      else next(null,null);
    });
  },
  updateResult(job,result,done) {
    if( job.name == JOB_UPDATE_AGENT_CONFIG ) {
      job.state = STATUS_AGENT_UPDATED;
    } else {
      job.state = STATUS_JOB_COMPLETED;
    }

    job.result = result;
    job.save( error => done(error) );

    // notify job result to clients
    if( job.notify ) {
      NotificationService.sendSNSNotification(
        job,{
          topic:"jobs",
          subject:"job_update"
        }
      );

      job.populate([{path:'user'},{path:'host'}],error => {
        var stdout, stderr, code, result = job.result;

        if(result){
          stdout = result.stdout?result.stdout.trim():'no stdout';
          stderr = result.stderr?result.stderr.trim():'no stderr';
          code = result.code||'no code';
        }

        var html = 
          `<h3>Task ${job.task.name} execution completed on ${job.host.hostname}.</h3><ul>
          <li>stdout : ${stdout}</li>
          <li>stderr : ${stderr}</li>
          <li>code : ${code}</li>
          </ul>`;

        NotificationService.sendEmailNotification({
          customer_name: job.customer_name,
          subject: `[Task] ${job.task.name} executed on ${job.host.hostname}`,
          content: html,
          to: job.user.email
        });
      });
    }
  }
};

module.exports = service ;
