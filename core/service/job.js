"use strict"

const App = require('../app')
const async = require('async')
const globalconfig = require('config')
const logger = require('../lib/logger')('eye:jobs')
const elastic = require('../lib/elastic')
const LIFECYCLE = require('../constants/lifecycle')
const JOBS = require('../constants/jobs')

const JobModels = require('../entity/job')
const Job = JobModels.Job
const ScriptJob = JobModels.Script
const ScraperJob = JobModels.Scraper

const Script = require('../entity/file').Script
const TaskEvent = require('../entity/event').TaskEvent
const EventDispatcher = require('./events')
const NotificationService = require('./notification')

const STATE_SUCCESS = 'success'
const STATE_FAILURE = 'failure'

module.exports = {
  /**
   * @param {Object} input
   * @param {Function} next
   */
  fetchBy (input,next) {
    const query = {}
    if (input.host) query.host_id = input.host._id
    if (input.state) query.state = input.state
    if (input.lifecycle) query.lifecycle = input.lifecycle

    Job.find(query,next)
  },
  /**
   *
   * @param {Object} input
   * @param {Function} next
   *
   */
  getNextPendingJob(input,next) {
    const query = {
      lifecycle: LIFECYCLE.READY,
      host_id: input.host._id
    }

    Job.findOne(query, (error,job) => {
      if (job!==null) {
        job.lifecycle = LIFECYCLE.ASSIGNED
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
   * @param {Object} input
   * @property {Event} input.event
   * @property {Task} input.task
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Boolean} input.notify
   * @param {Function(Error,Job)} done
   */
  create (input, done) {
    const task = input.task
    const type = task.type

    const afterCreate = (err, job) => {
      if (err) done(err)
      else done(null, job)
    }

    App.taskManager.populate(task, (err) => {
      if (err) return done(err);

      if (!task.host) {
        err = new Error('invalid task ' + task._id  + ' does not has a host assigned');
        return done(err)
      }

      if (jobInProgress(task.lastjob) === true) {
        err = new Error('job in progress')
        err.statusCode = 423
        return done(err, task.lastjob)
      }

      removeOldJobs(task)

      if (type == 'script') {
        createScriptJob(input, afterCreate)
      } else if (type == 'scraper') {
        createScraperJob(input, afterCreate)
      } else {
        err = new Error('invalid or undefined task type ' + task.type)
        done(err)
      }
    })
  },
  /**
   *
   * @param {Job} job
   * @param {Object} result
   * @param {Function} done
   *
   */
  update (job, result, done) {
    // if not specified asume success
    var state = (result.state || STATE_SUCCESS)

    job.lifecycle = LIFECYCLE.FINISHED
    job.state = state // final job state
    job.result = result
    job.save(err => {
      if (err) logger.log(err)
      done(err, job)
    })

    // if job is an agent update, break
    if (job.name == JOBS.AGENT_UPDATE) return

    var key = globalconfig.elasticsearch.keys.task.result
    registerJobOperation(key, job)

    // job completed mail.
    //new ResultMail ( job )

    // trigger result event
    new ResultEvent ( job )
  },
  cancel (job, next) {
    next||(next=()=>{})
    job.lifecycle = LIFECYCLE.CANCELED
    job.save(err => {
      if (err) {
        logger.error('fail to cancel job %s', job._id)
        logger.data(job)
        logger.error(err)
      }
      logger.log('job %s canceled', job._id)
      next(err)
    })
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
  }
}

const jobInProgress = (job) => {
  if (!job) return false
  return job.lifecycle === LIFECYCLE.READY ||
    job.lifecycle === LIFECYCLE.ASSIGNED
}

/**
 *
 * remove old jobs status, the history is keept in historical database
 * this registry is just for operations
 *
 */
const removeOldJobs = (task) => {
  logger.log('removing old jobs of task %s', task._id)
  Job.remove({ task_id: task._id }, function(err) {
    if (err) {
      logger.error('Failed to remove old jobs registry for task %s', task._id)
      logger.error(err)
    }
  })
}

/**
 *
 * register job operation in elastic search.
 * works for result and execution.
 *
 */
const registerJobOperation = (key, job) => {
  // submit job operation to elastic search
  job.populate([
    { path: 'user' },
    { path: 'host' }
  ], (err) => {
    const data = {
      hostname: job.host.hostname,
      customer_name: job.customer_name,
      user_id: job.user._id,
      user_email: job.user.email,
      task_name: job.task.name,
      task_type: job.task.type,
      state: job.state,
    }

    if (job._type == 'ScraperJob') {
      data.task_url = job.task.url
      data.task_method = job.task.method
      data.task_status_code = job.task.status_code 
      data.task_pattern = job.task.pattern
    } else {
      data.script_name = job.script.filename
      data.script_md5 = job.script.md5
      data.script_last_update = job.script.last_update
      data.script_mimetype = job.script.mimetype
    }

    if (job.result) {
      data.result = job.result
    }
    elastic.submit(job.customer_name,key,data)
  })
}

const createScriptJob = (input, done) => {
  const task = input.task;
  const script_id = task.script_id;
  const query = Script.findById(script_id)

  query.exec((error,script) => {
    const job = new ScriptJob();
    job.task = task.toObject(); // >>> add .id 
    job.script = script.toObject(); // >>> add .id 
    job.task_id = task._id;
    job.script_id = script._id;
    job.user = input.user;
    job.user_id = input.user._id;
    job.host_id = task.host_id;
    job.host = task.host_id;
    job.name = task.name;
    job.customer_id = input.customer._id;
    job.customer_name = input.customer.name;
    job.notify = input.notify;
    job.lifecycle = LIFECYCLE.READY
    job.event = input.event||null;
    job.save(err => {
      if (err) return done(err)

      var key = globalconfig.elasticsearch.keys.task.execution;
      registerJobOperation(key, job);

      logger.log('script job created.');
      done(null, job);
    })
  })
}

/**
 *
 *
 */
const createScraperJob = (input, done) => {
  const task = input.task
  const job = new ScraperJob()
  job.task = task.toObject(); // >>> add .id 
  job.task_id = task._id;
  job.user = input.user;
  job.user_id = input.user._id;
  job.host_id = task.host_id;
  job.host = task.host_id;
  job.name = task.name;
  job.customer_id = input.customer._id;
  job.customer_name = input.customer.name;
  job.notify = input.notify;
  job.lifecycle = LIFECYCLE.READY
  job.event = input.event||null;
  job.save(error => {
    if(error) return done(error);

    var key = globalconfig.elasticsearch.keys.task.execution;
    registerJobOperation(key, job);

    logger.log('scraper job created.');
    done(null, job);
  });
}

/**
 *
 *
 */
function ResultEvent (job) {
  TaskEvent.findOne({
    emitter_id: job.task.id,
    enable: true,
    name: job.state
  }, (err, event) => {
    if (err) return logger.error(err);

    if (!event) {
      var err = new Error('no event handler defined for state "' + job.state + '" on task ' + job.task.id);
      return logger.error(err);
    }

    EventDispatcher.dispatch(event);
  });
}

//function ResultMail ( job ) {
//  /**
//   *
//   * parse result log and return html to send via email
//   *
//   */
//  const scriptExecutionLog = (job) => {
//    var html
//    var stdout
//    var stderr
//    var code
//    var result = (job.result && job.result.script_result) || null
//
//    if (!result) {
//      html = `<span>script execution is not available</span>`
//    } else {
//      stdout = result.stdout ? result.stdout.trim() : 'no stdout'
//      stderr = result.stderr ? result.stderr.trim() : 'no stderr'
//      code = result.code || 'no code'
//      html = `<pre><ul>
//        <li>stdout : ${stdout}</li>
//        <li>stderr : ${stderr}</li>
//        <li>code : ${code}</li>
//        </ul></pre>`
//    }
//    return html
//  }
//
//  const scriptExecutionMail = (job,emails) => {
//    var state
//    var html
//    var log = scriptExecutionLog(job)
//    var result = job.result
//
//    if (result && result.script_result) {
//      if (result.event=='killed' || result.script_result.killed) {
//        state = 'interrupted'
//        html = `
//          <h3>Task ${job.task.name} execution on host ${job.host.hostname} has been interrupted.</h3>
//          <p>The script ${job.script.filename} execution takes more than 10 minutos to finish and was interrupted.</p>
//          <p>If you need more information, please contact the administrator</p>
//          `
//      } else {
//        state = 'completed'
//        html = `<h3>Task ${job.task.name} execution on ${job.host.hostname} has been completed.</h3>`
//      }
//    }
//
//    html += `<span>Script execution log </span><br/>` + log;
//
//    NotificationService.sendEmailNotification({
//      customer_name: job.customer_name,
//      subject: `[TASK] ${job.task.name} executed on ${job.host.hostname} ${state}`,
//      content: html,
//      to: emails
//    });
//
//    return;
//  }
//
//  this.ScriptJob = function (job,emails) {
//    return scriptExecutionMail(job,emails);
//  }
//
//  this.ScraperJob = function (job,emails) {
//    var html = `<h3>Task ${job.task.name} execution completed on ${job.host.hostname}.</h3>`;
//
//    NotificationService.sendEmailNotification({
//      customer_name: job.customer_name,
//      subject: `[TASK] ${job.task.name} executed on ${job.host.hostname}`,
//      content: html,
//      to: emails
//    });
//  }
//
//  App.customer.getAlertEmails(
//    job.customer_name,
//    (err, emails) => {
//      var mailTo
//      var extraEmail = []
//      var acls = job.task.acl
//
//      if (Array.isArray(acls) && acls.length>0) {
//        extraEmail = acls.filter(email => emails.indexOf(email) === -1);
//      }
//
//      mailTo = extraEmail.length>0 ? emails.concat(extraEmail) : emails;
//
//      job.populate([
//        { path: 'user' },
//        { path: 'host' }
//      ], error => {
//        this[ job._type ]( job, mailTo );
//      });
//    }
//  )
//}
