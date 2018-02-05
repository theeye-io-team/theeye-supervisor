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
const StateConstants = require('../constants/states')

const JobModels = require('../entity/job')
const Job = JobModels.Job
const ScriptJob = JobModels.Script
const ScraperJob = JobModels.Scraper
const Script = require('../entity/file').Script

const TaskEvent = require('../entity/event').TaskEvent
const NotificationService = require('./notification')

module.exports = {
  ///**
  // * @param {Object} input
  // * @param {Function} next
  // */
  //fetchBy (input,next) {
  //  const query = {}
  //  if (input.host) query.host_id = input.host._id
  //  if (input.state) query.state = input.state
  //  if (input.lifecycle) query.lifecycle = input.lifecycle
  //  Job.find(query,next)
  //},
  fetchBy (filter, next) {
    return Job.fetchBy(filter, (err,jobs) => {
      if (err) return next(err)
      if (jobs.length===0) return next(null,[])
      next(null, jobs)
    })
  },
  /**
   *
   * @param {Object} input
   * @property {User} input.user
   * @property {Host} input.host
   * @property {Customer} input.customer
   * @param {Function} next
   *
   */
  getNextPendingJob (input, next) {
    var topic
    const query = {
      lifecycle: LifecycleConstants.READY,
      host_id: input.host._id
    }

    Job.findOne(query, (err,job) => {
      if (err) {
        logger.error('%o',err)
        next(err)
      }

      if (job!==null) {
        if (jobMustHaveATask(job) && !job.task) {
          job.lifecycle = LifecycleConstants.CANCELED
          job.save(err => next(err,null)) // job with error
          topic = TopicsConstants.task.cancelation // cancel
        } else {
          job.lifecycle = LifecycleConstants.ASSIGNED
          job.save(err => {
            if (err) {
              logger.error('%o',err)
              return next(err)
            }

            next(null,job)
          })
          topic = TopicsConstants.task.sent // sent to agent
        }

        registerJobOperation(Constants.UPDATE, topic, {
          task: job.task,
          job: job,
          user: input.user,
          customer: input.customer
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

    if (!task) {
      err = new Error('task is required')
      return done(err)
    }

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
          user: input.user,
          customer: input.customer
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
   * @summary Finalize task execution. Save result and submit to elk
   *
   * @param {Object} input
   * @property {Job} input.job
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Object} input.result
   * @param {Function} done
   *
   */
  finish (input, done) {
    const job = input.job
    const user = input.user
    const customer = input.customer
    const result = input.result

    // if it is not a declared failure, assume success
    var state = ((input.state||result.state)===StateConstants.FAILURE)?StateConstants.FAILURE:StateConstants.SUCCESS

    job.state = state
    job.lifecycle = LifecycleConstants.FINISHED
    job.result = result.data
    job.save(err => {
      if (err) {
        logger.log(err)
        return
      }

      done(err, job) // continue process in paralell
      
      //if (job.name==JobsConstants.AGENT_UPDATE) {
      //  return // if job is an agent update, skip notifications and events
      //}

      let topic = TopicsConstants.task.result
      registerJobOperation(Constants.UPDATE, topic, {
        job, user, customer, task: job.task
      })

      //new ResultMail(job) // job completed mail
      new ResultEvent(job) // trigger result event
    })
  },
  /**
   *
   * @summary Cancel Job execution.
   * Cancel if READY or Terminate if ASSIGNED.
   * Else abort
   *
   * @param {Object} input
   * @property {Job} input.job
   * @property {Customer} input.customer
   * @property {User} input.user
   *
   */
  cancel (input, next) {
    const job = input.job
    const task = job.task
    const customer = input.customer
    const user = input.user

    let lifecycle = cancelJobNextLifecycle(job)
    if (!lifecycle) {
      let err = new Error(`cannot cancel job. current state lifecycle "${job.lifecycle}" does not allow the transition`)
      err.statusCode = 400
      return next(err)
    }

    next||(next=()=>{})
    job.lifecycle = lifecycle
    job.result = {}
    job.state = StateConstants.CANCELED
    job.save(err => {
      if (err) {
        logger.error('fail to cancel job %s', job._id)
        logger.data(job)
        logger.error(err)
        return next(err)
      }

      next(null, job)

      logger.log('job %s terminated', job._id)

      let topic = TopicsConstants.task.terminate // terminated
      registerJobOperation(Constants.UPDATE, topic, {
        customer: input.customer,
        task, job, user
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

const jobMustHaveATask = (job) => {
  return job._type === 'ScraperJob' || job._type === 'ScriptJob'
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
 * @property {Customer} input.customer
 *
 */
const registerJobOperation = (operation, topic, input) => {
  //const job = input.job
  //const task = input.task || job.task || {}
  //const user = input.user
  //const customer = input.customer
  let { job, user, customer } = input
  const task = (input.task || job.task || {})

  // submit job operation to elastic search
  job.populate([
    { path: 'host' },
    { path: 'user' }
  ], (err) => {
    const payload = {
      hostname: job.host.hostname,
      state: job.state || 'undefined',
      lifecycle: job.lifecycle,
      name: task.name,
      type: task.type,
      organization: customer.name,
      user_id: user._id,
      user_name: user.email,
      user_email: user.username,
      operation: operation,
      job_type: job._type
    }

    if (jobMustHaveATask(job) && !task) {
      const msg = `job ${job._id}/${job._type} task is not valid or undefined`
      logger.error(new Error(msg))
    }

    if (job._type == 'ScraperJob') {
      payload.url = task.url
      payload.method = task.method
      payload.statuscode = task.status_code 
      payload.pattern = task.pattern
    } else if (job._type == 'ScriptJob') {
      if (!job.script) {
        const msg = `job ${job._id}/${job._type} script is not valid or undefined`
        logger.error(new Error(msg))
      }

      const script = job.script || {}
      payload.filename = script.filename
      payload.md5 = script.md5
      payload.mtime = script.last_update
      payload.mimetype = script.mimetype
    } else if (job._type == 'AgentUpdateJob') {
      // nothing yet
    } else {
      // unhandled job type
    }

    if (job.result) payload.result = job.result

    elastic.submit(customer.name, topic, payload) // topic = topics.task.execution/result , CREATE/UPDATE

    NotificationService.generateSystemNotification({
      topic: TopicsConstants.job.crud,
      data: {
        hostname: job.hostname,
        organization: customer.name,
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
 * @summary obtain next valid lifecycle state if apply for current job.lifecycle
 * @param {Job} job
 * @return {String} lifecycle string
 *
 */
const cancelJobNextLifecycle = (job) => {
  if (job.lifecycle===LifecycleConstants.READY) {
    return LifecycleConstants.CANCELED
  } else if (job.lifecycle===LifecycleConstants.ASSIGNED) {
    return LifecycleConstants.TERMINATED
  } else {
    // current state cannot be canceled or terminated
    return null
  }
}

/**
 *
 *
 */
function ResultEvent (job) {
  if (!job.task) return // cannot determine events without a task

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

    App.eventDispatcher.dispatch(event);
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
