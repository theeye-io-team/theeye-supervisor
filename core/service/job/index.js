const async = require('async')
const merge = require('lodash/merge')
const globalconfig = require('config')
const App = require('../../app')
const logger = require('../../lib/logger')('service:jobs')
const elastic = require('../../lib/elastic')
const Constants = require('../../constants')
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const TaskConstants = require('../../constants/task')
const TopicsConstants = require('../../constants/topics')
const StateConstants = require('../../constants/states')
const JobModels = require('../../entity/job')
const TaskModel = require('../../entity/task').Entity
const TaskEvent = require('../../entity/event').TaskEvent
const JobFactory = require('./factory')

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
  //  JobModels.Job.find(query,next)
  //},
  fetchBy (filter, next) {
    return JobModels.Job.fetchBy(filter, (err,jobs) => {
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
    if (!input.host) return next(new Error('host is required'))
    const query = {
      lifecycle: LifecycleConstants.READY,
      host_id: input.host._id
    }

    JobModels.Job.findOne(query, (err,job) => {
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
          job,
          task: job.task,
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
   * @property {Task} input.task
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Boolean} input.notify
   * @property {String[]} input.script_arguments (will be deprecated)
   * @property {String[]} input.task_arguments_values 
   * @property {ObjectId} input.workflow_job_id current workflow ejecution
   * @property {ObjectId} input.workflow_job
   * @param {Function(Error,Job)} done
   */
  create (input, done) {
    let { task } = input
    var err

    if (!task) {
      err = new Error('task is required')
      return done(err)
    }

    verifyTaskBeforeExecution(task, (err) => {
      if (err) { return done(err) }
      removeExceededJobsCount(task, () => {
        JobFactory.create(task, input, (err, job) => {
          if (err) { return done(err) }

          logger.log('job created.')
          let topic = TopicsConstants.task.execution
          registerJobOperation(Constants.CREATE, topic, {
            task,
            job,
            user: input.user,
            customer: input.customer
          })

          // finish the task at once
          if (TaskConstants.TYPE_DUMMY === task.type) {
            this.finish(
              Object.assign({}, input, {
                result: {
                  state: StateConstants.SUCCESS,
                  data: {
                    output: input.task_arguments_values
                  }
                }, job
              }), done
            )
          } else {
            done(null, job)
          }
        })
      })
    })
  },
  createByWorkflow (input, next) {
    let { workflow, user } = input

    const createWorkflowJob = (props, next) => {
      let wJob = new JobModels.Workflow(props)
      wJob.save( (err, wJob) => {
        if (err) { return next(err) } // break

        let data = wJob.toObject()
        data.user = {
          id: user._id.toString(),
          username: user.username,
          email: user.email
        }

        App.notifications.generateSystemNotification({
          topic: TopicsConstants.job.crud,
          data: {
            organization: props.customer_name,
            operation: Constants.CREATE,
            model_type: data._type,
            model: data
          }
        })

        next(null, wJob)
      })
    }

    getFirstTask(workflow, (err, task) => {
      if (err) { return next(err) }

      let wProps = Object.assign({}, input, {
        customer: input.customer,
        customer_id: input.customer._id.toString(),
        customer_name: input.customer.name,
        workflow_id: workflow._id,
        workflow: workflow._id,
        user: user._id,
        user_id: user._id,
        task_arguments_values: null
      })

      createWorkflowJob(wProps, (err, wJob) => {
        if (err) { return next(err) }

        this.create(
          Object.assign({}, input, {
            task,
            workflow_job_id: wJob._id,
            workflow_job: wJob._id
          }),
          (err, tJob) => {
            if (err) { return next(err) }
            next(null, wJob)
          }
        )
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
    const task = job.task

    // if it is not a declared failure, assume success
    let state = (input.state || result.state || StateConstants.SUCCESS)
    var trigger_name = (state === StateConstants.FAILURE) ?
      StateConstants.FAILURE : StateConstants.SUCCESS

    // data output, can be anything. stringify for security
    job.state = state
    job.trigger_name = trigger_name
    job.lifecycle = LifecycleConstants.FINISHED
    job.result = result.data

    if (result.data && result.data.output) {
      if (Array.isArray(result.data.output)) {
        job.output = result.data.output
        job.result.output = JSON.stringify(result.data.output) // stringify for security
      } else {
        try {
          let output = JSON.parse(result.data.output)
          if (Array.isArray(output)) {
            job.output = output
            job.result.output = result.data.output
          }
        } catch (jsonError) {
          logger.error('job result output is invalid json array. %s', result.data.output)
          logger.error(jsonError)
        }
      }
    }

    job.save(err => {
      if (err) logger.log('%o',err)

      done(err, job) // continue process in paralell

      let topic = TopicsConstants.task.result
      registerJobOperation(Constants.UPDATE, topic, {
        job, user, customer, task
      })

      //new ResultMail(job) // job completed mail
      dispatchFinishedTaskExecutionEvent (job, trigger_name)
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

    App.notifications.sendEmailNotification({
      customer_name: input.customer_name,
      subject: `[TASK] Task ${input.task_name} execution on ${input.hostname} cancelation`,
      content: html,
      to: input.to
    });
  },
  /**
   *
   * @summary create an integration job for the agent.
   *
   * @param {Object}
   * @property {String} integration
   * @property {String} operation
   * @property {Host} host
   * @property {Object} config integration options and configuration
   *
   */
  createIntegrationJob ({ integration, operation, host, config }, next) {
    const factoryCreate = JobModels.IntegrationsFactory.create

    let props = merge(
      {
        lifecycle: LifecycleConstants.READY,
        origin: JobConstants.ORIGIN_USER,
        operation,
        host,
        host_id: host._id,
        notify: true
      },
      config
    )

    const job = factoryCreate({ integration, props })
    currentIntegrationJob(job, (err, currentJob) => {
      if (err) return next(err)
      if (jobInProgress(currentJob) === true) {
        err = new Error('integration job in progress')
        err.statusCode = 423
        logger.error('%o',err)
        return next(err, currentJob)
      }

      // remove old/finished integration job of the same type.
      // cannot be more than one integration job, in the same host at the same time.
      JobModels.Job
        .remove({
          _type: job._type,
          host_id: job.host_id
        })
        .exec(err => {
          if (err) {
            logger.error('Failed to remove old jobs')
            logger.error('%o',err)
            return next(err)
          }

          job.save(err => {
            if (err) logger.error('%o', err)
            next(err, job)
          })
        })
    })
  }
}

const taskRequireHost = (task) => {
  var res = (
    task.type === TaskConstants.TYPE_SCRIPT ||
    task.type === TaskConstants.TYPE_SCRAPER
  )
  return res
}

const verifyTaskBeforeExecution = (task, next) => {
  App.taskManager.populate(task, (err, taskData) => {
    if (err) return next(err);

    if (!task.customer) {
      err = new Error('FATAL. Task ' + task._id + 'does not has a customer')
      logger.error('%o',err)
      return next(err)
    }

    if (taskRequireHost(task) && !task.host) {
      err = new Error('invalid task ' + task._id  + ' does not has a host assigned')
      logger.error('%o',err)
      return next(err)
    }

    next()
  })
}

const currentIntegrationJob = (job, next) => {
  JobModels.Job
    .findOne({
      _type: job._type,
      host_id: job.host_id
    })
    .exec( (err, inprogressjob) => {
      if (err) {
        logger.error('Failed to fetch old jobs')
        logger.error('%o',err)
      }
      next(err, inprogressjob||null)
    })
}

/**
 *
 *
 */
const removeExceededJobsCount = (task, next) => {
  const LIMIT = JobConstants.JOBS_LOG_COUNT_LIMIT - 1 // docs limit minus 1, because why are going to create the new one after removing older documents
  const Job = JobModels.Job

  Job.count(
    { task_id: task._id.toString() },
    (err, count) => {
      if (err) { return next(err) }

      // if count > limit allowed, then search top 6, and destroy the 6th and the others
      if (count > LIMIT) {
        Job
          .find({ task_id: task._id.toString() })
          .sort({ _id: -1 })
          .limit(LIMIT)
          .exec((err, docs) => {
            let lastDoc = docs[LIMIT - 1]

            // only remove finished jobs
            Job.remove({
              task_id: task._id.toString(),
              _id: { $lt: lastDoc._id.toString() }, // remove older documents than last
              $and: [
                { lifecycle: { $ne: LifecycleConstants.READY } },
                { lifecycle: { $ne: LifecycleConstants.ASSIGNED } },
                { lifecycle: { $ne: LifecycleConstants.ONHOLD } }
              ]
            }, next)
          })
      } else { return next() }
    }
  )
}

const jobMustHaveATask = (job) => {
  var result = (
    job._type === JobConstants.SCRAPER_TYPE ||
    job._type === JobConstants.SCRIPT_TYPE ||
    job._type === JobConstants.APPROVAL_TYPE ||
    job._type === JobConstants.DUMMY_TYPE
  )
  return result
}

const jobInProgress = (job) => {
  if (!job) return false
  let inProgress = (
    job.lifecycle === LifecycleConstants.READY ||
    job.lifecycle === LifecycleConstants.ASSIGNED ||
    job.lifecycle === LifecycleConstants.ONHOLD
  )
  return inProgress
}

/**
 *
 * @summary remove old job status, the history is kept in historical database.
 * @param {Task} task
 * @param {Function} next
 *
 */
const removeOldTaskJobs = (task, next) => {
  logger.log('removing old jobs of task %s', task._id)

  let filters = { task_id: task._id }

  JobModels.Job.remove(filters, function (err) {
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
  let { job, user, customer } = input
  const task = (input.task || job.task || {})

  const jobPopulate = (next) => {
    // submit job operation to elastic search
    job.populate([
      { path: 'host' },
      { path: 'user' }
    ], (err) => {
      if (!job.user) {
        return next({})
      }

      job.user.publish({}, (err, jobUser) => {
        next({ user: jobUser })
      })
    })
  }

  jobPopulate(populateResult => {
    job.user = populateResult.user

    const payload = {
      state: job.state || 'undefined',
      lifecycle: job.lifecycle,
      task_name: task.name,
      task_type: task.type,
      organization: customer.name,
      user_id: user._id,
      user_name: user.username,
      user_email: user.email,
      operation: operation,
      job_type: job._type
    }

    if (
      job._type !== JobConstants.APPROVAL_TYPE &&
      job._type !== JobConstants.DUMMY_TYPE
    ) {
      payload.hostname = job.host.hostname
    }

    if (jobMustHaveATask(job) && !task) {
      const msg = `job ${job._id}/${job._type} task is not valid or undefined`
      logger.error(new Error(msg))
    }

    if (job._type === JobConstants.SCRAPER_TYPE) {
      payload.url = task.url
      payload.method = task.method
      payload.statuscode = task.status_code
      payload.pattern = task.pattern
    } else if (job._type == JobConstants.SCRIPT_TYPE) {
      if (!job.script) {
        const msg = `job ${job._id}/${job._type} script is not valid or undefined`
        logger.error(new Error(msg))
      }

      const script = job.script || {}
      payload.filename = script.filename
      payload.md5 = script.md5
      payload.mtime = script.last_update
      payload.mimetype = script.mimetype
    } else if (job._type == JobConstants.APPROVAL_TYPE) {
      // nothing yet
    } else if (job._type == JobConstants.DUMMY_TYPE) {
      // nothing yet
    } else if (job._type == JobConstants.AGENT_UPDATE_TYPE) {
      // nothing yet
    } else {
      // unhandled job type
    }

    App.notifications.generateSystemNotification({
      topic: TopicsConstants.job.crud,
      data: {
        hostname: job.hostname,
        organization: customer.name,
        operation: operation,
        model_type: job._type,
        model: job,
        approver_id: (job.task && job.task.approver_id) || undefined
      }
    })

    if (job.result) {
      payload.result = job.result
      if (job._type == JobConstants.SCRAPER_TYPE) {
        if (payload.result.response && payload.result.response.body) {
          delete payload.result.response.body
        }
      }
    }

    elastic.submit(customer.name, topic, payload) // topic = topics.task.[execution||result] , CREATE/UPDATE
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
  if (
    job.lifecycle === LifecycleConstants.READY ||
    job.lifecycle === LifecycleConstants.ONHOLD
  ) {
    return LifecycleConstants.CANCELED
  } else if (job.lifecycle === LifecycleConstants.ASSIGNED) {
    return LifecycleConstants.TERMINATED
  } else {
    // current state cannot be canceled or terminated
    return null
  }
}

/**
 *
 * @summary The task execution is finished.
 * @param {Job} job
 * @param {String} trigger triggered event name
 * @param {Object} data
 *
 */
const dispatchFinishedTaskExecutionEvent = (job, trigger) => {
  let { task_id, workflow_id, output } = job
  let topic

  // cannot trigger a workflow event without a task
  if (!task_id) { return }

  TaskEvent.findOne({
    emitter_id: task_id,
    enable: true,
    name: trigger
  }, (err, event) => {
    if (err) { return logger.error(err); }

    if (!event) {
      var err = new Error('no handler defined for event named "' + trigger + '" on task ' + task_id)
      return logger.error(err)
    }

    // trigger task execution event within a workflow
    if (workflow_id) {
      topic = TopicsConstants.workflow.execution
    } else {
      topic = TopicsConstants.task.execution
    }

    App.eventDispatcher.dispatch({
      topic,
      event,
      workflow_job_id: job.workflow_job_id, // current workflow execution
      workflow_id,
      output
    })
  })
}

const getFirstTask = (workflow, next) => {
  let taskId = workflow.start_task_id
  TaskModel.findById(taskId, (err, task) => {
    if (err) {
      return next(err)
    }
    if (!task) {
      return next(new Error('workflow first task not found'))
    }

    return next(null, task)
  })
}

