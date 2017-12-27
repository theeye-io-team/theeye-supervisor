"use strict"

const App = require('../app')
const async = require('async')
const globalconfig = require('config')
const logger = require('../lib/logger')('eye:jobs')
const elastic = require('../lib/elastic')
const LifecycleConstants = require('../constants/lifecycle')
const JobsConstants = require('../constants/jobs')
const Constants = require('../constants')
const TaskConstants = require('../constants/task')
const TopicsConstants = require('../constants/topics')

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
      lifecycle: LifecycleConstants.READY,
      host_id: input.host._id
    }

    Job.findOne(query, (error,job) => {
      if (job!==null) {
        job.lifecycle = LifecycleConstants.ASSIGNED
        job.save(error => {
          if (error) throw error
          next(null,job)
        })

        let topic = TopicsConstants.task.sent // sent to agent
        registerJobOperation(Constants.UPDATE, topic, {
          task: job.task,
          job: job,
          user: input.user
        })
      } else {
        next(null,null)
      }
    })
  },
  /**
   * @author Facugon
   * @param {Object} input
   * @property {Event} input.event
   * @property {Task} input.task
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Boolean} input.notify
   * @property {String[]} input.script_arguments only required if it is a script-type job
   * @param {Function(Error,Job)} done
   */
  create (input, done) {
    const task = input.task
    const type = task.type

    App.taskManager.populate(task, (err, taskData) => {
      if (err) return done(err);

      if (!task.host) {
        err = new Error('invalid task ' + task._id  + ' does not has a host assigned');
        return done(err)
      }

      if (jobInProgress(taskData.lastjob) === true) {
        err = new Error('job in progress')
        err.statusCode = 423
        return done(err, taskData.lastjob)
      }

      const created = (err, job) => {
        if (err) { return done(err) }
        logger.log('script job created.')
        let topic = TopicsConstants.task.execution
        registerJobOperation(Constants.CREATE, topic, {
          task: task,
          job: job,
          user: input.user
        })
        done(null, job)
      }

      const prepareTaskArguments = (args, next) => {
        if (!args) {
          App.taskManager.prepareTaskArgumentsValues(
            task.script_arguments,
            [], // only fixed-arguments if not specified
            (err, args) => next(err, args)
          )
        } else next(null,args)
      }

      removeOldTaskJobs(task, () => {
        if (type == TaskConstants.TYPE_SCRIPT) {
          prepareTaskArguments(input.script_arguments, (err,args) => {
            if (err) return done(err)
            input.script_arguments = args
            createScriptJob(input, created)
          })
        } else if (type == TaskConstants.TYPE_SCRAPER) {
          createScraperJob(input, created)
        } else {
          err = new Error('invalid or undefined task type ' + task.type)
          return done(err)
        }
      })
    })
  },
  /**
   *
   * @summary Finalize task execution. Save result and submit result to elk
   *
   * @param {Object} input
   * @property {Job} input.job
   * @property {User} input.user
   * @property {Object} input.result
   * @param {Function} done
   *
   */
  update (input, done) {
    const job = input.job
    const user = input.user
    const result = input.result

    // if not failure, assume success
    var state = (result.state===STATE_FAILURE) ? STATE_FAILURE : STATE_SUCCESS

    job.lifecycle = LifecycleConstants.FINISHED
    job.state = state
    job.result = result.data
    job.save(err => {
      if (err) logger.log(err)
      done(err, job)
    })

    // if job is an agent update, skip notifications and events
    if (job.name==JobsConstants.AGENT_UPDATE) return

    let topic = TopicsConstants.task.result
    registerJobOperation(Constants.UPDATE, topic, {
      task: job.task,
      job: job,
      user: user
    })

    // job completed mail.
    //new ResultMail ( job )

    // trigger result event
    new ResultEvent ( job )
  },
  cancel (job, next) {
    next||(next=()=>{})
    job.lifecycle = LifecycleConstants.CANCELED
    job.save(err => {
      if (err) {
        logger.error('fail to cancel job %s', job._id)
        logger.data(job)
        logger.error(err)
        return next(err)
      }

      logger.log('job %s canceled', job._id)

      let topic = TopicsConstants.task.cancelation // cancelation
      registerJobOperation(Constants.UPDATE, topic, {
        task: job.task,
        job: job,
        user: user
      })
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
  return job.lifecycle === LifecycleConstants.READY ||
    job.lifecycle === LifecycleConstants.ASSIGNED
}

/**
 *
 * remove old jobs status, the history is keept in historical database
 * this registry is just for operations
 *
 */
const removeOldTaskJobs = (task, next) => {
  logger.log('removing old jobs of task %s', task._id)
  Job.remove({ task_id: task._id }, function(err) {
    if (err) {
      logger.error('Failed to remove old jobs registry for task %s', task._id)
      logger.error(err)
    }
    next(err)
  })
}

/**
 *
 * @summary register job operation in elastic search works for result and execution.
 * @param {String} operation
 * @param {String} topic
 * @param {Object} input
 * @property {Job} input.job
 * @property {User} input.user
 * @property {Task} input.task
 *
 */
const registerJobOperation = (operation, topic, input) => {
  const task = input.task
  const job = input.job
  const user = input.user

  // submit job operation to elastic search
  job.populate([
    { path: 'host' }
  ], (err) => {
    const payload = {
      hostname: job.host.hostname,
      state: job.state || 'undefined',
      lifecycle: job.lifecycle,
      name: task.name,
      type: task.type,
      organization: job.customer_name,
      user_id: user._id,
      user_name: user.email,
      user_email: user.username,
      operation: operation
    }

    if (job._type == 'ScraperJob') {
      payload.url = job.task.url
      payload.method = job.task.method
      payload.statuscode = job.task.status_code 
      payload.pattern = job.task.pattern
    } else {
      payload.filename = job.script.filename
      payload.md5 = job.script.md5
      payload.mtime = job.script.last_update
      payload.mimetype = job.script.mimetype
    }

    if (job.result) payload.result = job.result

    elastic.submit(job.customer_name, topic, payload) // topic = topics.task.execution/result , CREATE/UPDATE

    NotificationService.generateSystemNotification({
      topic: TopicsConstants.job.crud,
      data: {
        hostname: job.hostname,
        organization: job.customer_name,
        operation: operation,
        model_type: job._type,
        model: job
      }
    })
  })
}

const prepareScript = (script_id, next) =>  {
  const query = Script.findById(script_id)
  query.exec((err, script) => {
    if (err) {
      logger.error('%o',err)
      err.statusCode = 500
      return next(err)
    }

    if (!script) {
      let msg = 'cannot create job. script is no longer available'
      logger.error(msg)
      let err = new Error(msg)
      err.statusCode = 404
      return next(err)
    }

    next(null,script)
  })
}

/**
 * @param {Object} input
 * @property {String} input.script_id
 * @property {String[]} input.script_arguments ordered script arguments values
 */
const createScriptJob = (input, done) => {
  const task = input.task
  prepareScript(task.script_id, (err,script) => {
    if (err) return done(err)

    const job = new ScriptJob()
    job.script = script.toObject() // >>> add .id 
    job.script_id = script._id
    job.script_arguments = input.script_arguments
    job.script_runas = task.script_runas
    job.task = task.toObject() // >>> add .id 

    /**
     * @todo should remove hereunder line in the future.
     * only keep for backward compatibility with agents with version number equal or older than version 0.11.3.
     * at this moment this is overwriting saved job.task.script_arguments definition.
     */
    job.task.script_arguments = input.script_arguments

    job.task_id = task._id
    job.user = input.user
    job.user_id = input.user._id
    job.host_id = task.host_id
    job.host = task.host_id
    job.name = task.name
    job.customer_id = input.customer._id
    job.customer_name = input.customer.name
    job.notify = input.notify
    job.lifecycle = LifecycleConstants.READY
    job.event = input.event||null
    job.origin = input.origin
    job.save(err => {
      if (err) {
        logger.error('%o',err)
        return done(err)
      }
      done(null, job)
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
  job.lifecycle = LifecycleConstants.READY
  job.event = input.event||null
  job.origin = input.origin
  job.save(err => {
    if (err) {
      logger.error('%o',err)
      return done(err)
    }
    done(null, job)
  })
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
