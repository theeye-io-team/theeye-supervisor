"use strict";

const async = require('async');
const globalconfig = require('config');

var JobModels = require('../entity/job');
var Job = JobModels.Job;
var ScriptJob = JobModels.Script;
var ScraperJob = JobModels.Scraper;
var Script = require('../entity/script').Entity;
var TaskEvent = require('../entity/event').TaskEvent;
var EventDispatcher = require('./events');

var NotificationService = require('./notification');
var elastic = require('../lib/elastic');
var logger = require('../lib/logger')('eye:jobs');

const app = require('../app');

const JOB_UPDATE_AGENT_CONFIG = 'agent:config:update';
//const STATE_AGENT_UPDATED = 'agent-updated';
const STATE_SUCCESS = 'success';
const STATE_FAILURE = 'failure';
const STATE_NEW = 'new';

var service = {
  fetchBy (input,next) {
    var query = {};

    if( input.host ) query.host_id = input.host._id ;
    if( input.state ) query.state = input.state ;

    Job.find(query,function(error, jobs){
      next( jobs );
    });
  },
  getNextPendingJob(input,next) {
    var query = {};
    query.state = STATE_NEW;
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

    function afterCreate (err, job) {
      if(err) done(err);
      else done(null, job);
    }

    task.populate('host', err => {
      if(err) return done(err);

      if( !task.host ){
        var err = new Error('invalid task ' + task._id  + ' does not has a host assigned');
        return done(err);
      }

      if( type == 'script' ){
        createScriptJob(input, afterCreate);
      } else if( type == 'scraper' ){
        createScraperJob(input, afterCreate);
      } else {
        done( new Error('invalid or undefined task type ' + task.type) );
      }

    });
  },
  update ( job, result, done ) {
    var state = (result.state||STATE_FAILURE);
    job.state = state;
    job.result = result;
    job.save( err => {
      if (err) logger.log(err);
      done(err, job) 
    });

    // if job is an agent update, break
    if (job.name == 'agent:config:update') return;

    var message = { topic: "jobs", subject: "job_update" };
    NotificationService.sendSNSNotification(job, message);

    var key = globalconfig.elasticsearch.keys.task.result;
    registerJobOperation(key, job);

    // job completed mail.
    new ResultMail ( job );

    // trigger result event
    new ResultEvent ( job );
  },
  // automatic job scheduled . send cancelation
  sendJobCancelationEmail (input) {
    var cancelUrl = globalconfig.system.base_url +
      '/:customer/task/:task/schedule/:schedule/secret/:secret';

    var url = cancelUrl
      .replace(':customer',input.customer_name)
      .replace(':task',input.task_id)
      .replace(':secret',input.task_secret)
      .replace(':schedule',input.schedule_id);

    var html = `<h3>Task execution on ${input.hostname}<small> Cancel notification</small></h3>
    The task ${input.task_name} will be executed on ${input.hostname} at ${input.date}.<br/>
    If you want to cancel the task you have ${input.grace_time_mins} minutes.<br/>
    <br/>
    To cancel the Task <a href="${url}">press here</a> or copy/paste the following link in the browser of your preference : <br/>${url}<br/>.
    `;

    NotificationService.sendEmailNotification({
      customer_name: input.customer_name,
      subject: `[TASK] Task ${input.task_name} execution on ${input.hostname} cancelation`,
      content: html,
      to: input.to
    });
  },
  // send job canceled email
  /**
  sendJobCanceledEmail (input) {
    var html = `<h3>Task execution on ${input.hostname} canceled</h3>
    The task ${input.task_name} on host ${input.hostname} at ${input.date} has been canceled.<br/>`;

    NotificationService.sendEmailNotification({
      customer_name: input.customer_name,
      subject: `[TASK] Task ${input.task_name} execution on ${input.hostname} canceled`,
      content: html,
      to: input.to
    });
  },
  */
};

/**
 *
 *
 */
function ResultEvent (job) {
  TaskEvent.findOne({
    emitter: job.task.id,
    enable: true,
    name: job.state
  }, (err, event) => {
    if(err) return logger.error(err);

    if(!event){
      var err = new Error('no event handler defined for state "' + job.state + '" on task ' + job.task.id);
      return logger.error(err);
    }

    app.eventDispatcher.dispatch(event);
  });
}


/**
 *
 * register job operation in elastic search.
 * works for result and execution.
 *
 */
function registerJobOperation (key, job){
  // submit job operation to elastic search
  job.populate([
    { path: 'user' },
    { path: 'host' }
  ],
  (err) => {
    var data = {
      'hostname': job.host.hostname,
      'customer_name': job.customer_name,
      'user_id': job.user._id,
      'user_email': job.user.email,
      'task_name': job.task.name,
      'task_type': job.task.type,
      'state' : job.state,
    };

    if( job._type == 'ScraperJob' ){
      data.task_url = job.task.url;
      data.task_method = job.task.method;
      data.task_status_code = job.task.status_code ;
      data.task_pattern = job.task.pattern ;
    } else {
      data.script_name = job.script.filename;
      data.script_md5 = job.script.md5;
      data.script_last_update = job.script.last_update;
      data.script_mimetype = job.script.mimetype;
    }

    if( job.result ) data.result = job.result ;
    elastic.submit(job.customer_name,key,data);
  });
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
    job.state = STATE_NEW;
    job.event = input.event||null;
    job.save(error => {
      if(error) return done(error);

      var key = globalconfig.elasticsearch.keys.task.execution;
      registerJobOperation(key, job);

      logger.log('script job created.');
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
  job.state = STATE_NEW;
  job.event = input.event||null;
  job.save(error => {
    if(error) return done(error);

    var key = globalconfig.elasticsearch.keys.task.execution;
    registerJobOperation(key, job);

    logger.log('scraper job created.');
    done(null, job);
  });
}


function ResultMail ( job ) {

  /**
   *
   * parse result log and return html to send via email
   *
   */
  function scriptExecutionLog (job) {
    var html, stdout, stderr, code,
      result = (job.result&&job.result.script_result)||null;

    if (!result) {
      html = '<span>script execution is not available</span>';
    } else {
      stdout = result.stdout?result.stdout.trim():'no stdout',
      stderr = result.stderr?result.stderr.trim():'no stderr',
      code = result.code||'no code',
      html = `<pre><ul>
        <li>stdout : ${stdout}</li>
        <li>stderr : ${stderr}</li>
        <li>code : ${code}</li>
        </ul></pre>`;
    }
    return html;
  }

  function scriptExecutionMail (job,emails) {
    var state, html, log = scriptExecutionLog(job);

    var result = job.result;
    if (result && result.script_result) {
      if (result.event=='killed'||result.script_result.killed) {
        state = 'interrupted';
        html = `
          <h3>Task ${job.task.name} execution on host ${job.host.hostname} has been interrupted.</h3>
          <p>The script ${job.script.filename} execution takes more than 10 minutos to finish and was interrupted.</p>
          <p>If you need more information, please contact the administrator</p>
          `;
      } else {
        state = 'completed';
        html = `
          <h3>Task ${job.task.name} execution on ${job.host.hostname} has been completed.</h3>
          `;
      }
    }

    html += `<span>Script execution log </span><br/>` + log;

    NotificationService.sendEmailNotification({
      customer_name: job.customer_name,
      subject: `[TASK] ${job.task.name} on ${job.host.hostname} ${state}`,
      content: html,
      to: emails
    });

    return;
  }

  this.ScriptJob = function (job,emails) {
    return scriptExecutionMail(job,emails);
  }

  this.ScraperJob = function (job,emails) {
    var html = `<h3>Task ${job.task.name} execution completed on ${job.host.hostname}.</h3>`;

    NotificationService.sendEmailNotification({
      customer_name: job.customer_name,
      subject: `[TASK] ${job.task.name} executed on ${job.host.hostname}`,
      content: html,
      to: emails
    });
  }

  app.customer.getAlertEmails(
    job.customer_name,
    (err, emails) => {
      var mailTo,
        extraEmail = [],
        acls = job.task.acl;

      if (Array.isArray(acls) && acls.length>0) {
        extraEmail = acls.filter(email => emails.indexOf(email) === -1);
      }

      mailTo = extraEmail.length>0 ? emails.concat(extraEmail) : emails;

      job.populate([
        { path: 'user' },
        { path: 'host' }
      ], error => {
        this[ job._type ]( job, mailTo );
      });
    }
  );

};

function CreationMail (job) {
  var html = `<h3>Task ${job.task.name} will run on ${job.host.hostname}.</h3>`;

  NotificationService.sendEmailNotification({
    customer_name: job.customer_name,
    subject: `[TASK] New ${job.task.name} execution on ${job.host.hostname}`,
    content: html,
    to: job.user.email
  });
}


module.exports = service ;
