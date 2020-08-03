const async = require('async')
const merge = require('lodash/merge')
const globalconfig = require('config')
const App = require('../../app')
const logger = require('../../lib/logger')('service:jobs')
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
const NotificationService = require('../../service/notification')
const mongoose = require('mongoose')
const RegisterOperation = require('./register')

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
    return JobModels.Job.fetchBy(filter, (err, jobs) => {
      if (err) {
        return next(err)
      }
      if (jobs.length === 0) {
        return next(null, [])
      }
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
    if (!input.host) { return next(new Error('host is required')) }

    /**
     *
     * NOTE: jobs is an array of job data, there are NOT job models
     * cannot use job.save since jobs are not mongoose document
     *
     */
    const dispatchJobExecutionRecursive = (
      idx, jobs, terminateRecursion
    ) => {
      if (idx===jobs.length) { return terminateRecursion() }
      let job = JobModels.Job.hydrate(jobs[idx])
      //job.populate('task', err => {
        //if (err) { return terminateRecursion(err) }

        // Cancel this job and process next
        if (App.jobDispatcher.jobMustHaveATask(job) && !job.task) {
          // cancel invalid job
          job.lifecycle = LifecycleConstants.CANCELED
          job.save(err => {
            if (err) { logger.error('%o', err) }
            dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
          })

          RegisterOperation(Constants.UPDATE, TopicsConstants.task.cancelation, { job })
        } else {
          allowedMultitasking(job, (err, allowed) => {
            if (!allowed) {
              // just ignore this one
              dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
            } else {
              job.lifecycle = LifecycleConstants.ASSIGNED
              job.save(err => {
                if (err) { logger.error('%o', err) }
                terminateRecursion(err, job)
              })

              RegisterOperation(Constants.UPDATE, TopicsConstants.task.assigned, { job })
            }
          })
        }
      //})
    }

    let jobs = []
    JobModels.Job.aggregate([
      {
        $match: {
          host_id: input.host._id.toString(),
          lifecycle: LifecycleConstants.READY
        }
      },
      { $sort: { 'task_id': 1, 'creation_date': 1 } },
      { $group: { _id: '$task_id', nextJob: { $first: '$$ROOT' } } }
    ]).exec((err, groups) => {
      if (err) {
        logger.error('%o',err)
        return next(err)
      }

      if (groups.length>0) {
        let idx = 0
        dispatchJobExecutionRecursive(idx, groups.map(grp => grp.nextJob), next)
      } else {
        next()
      }
    })
  },
  /**
   * @param {Object} input
   * @property {Task} input.task
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Boolean} input.notify
   * @property {String[]} input.script_arguments (will be deprecated)
   * @property {String[]} input.task_arguments_values arguments definitions
   * @property {ObjectId} input.workflow_job_id current workflow ejecution
   * @property {ObjectId} input.workflow_job
   * @property {Workflow} input.workflow optional
   */
  async create (input) {
    let { task } = input
    let job

    if (!task) { throw new Error('task is required') }

    verifyTaskBeforeExecution(task)
    await removeExceededJobsCount(task, input.workflow)

    if (
      task.grace_time > 0 && ( // automatic origin
        input.origin === JobConstants.ORIGIN_WORKFLOW ||
        input.origin === JobConstants.ORIGIN_TRIGGER_BY
      )
    ) {
      job = await createScheduledJob(input) // agenda job
    } else {
      job = await createJob(input)
    }

    return job
  },
  async createAgentUpdateJob (host_id) {
    try {
      // check if there are update jobs already created for this host
      const jobs = await JobModels.Job.find({
        host_id,
        lifecycle: LifecycleConstants.READY
      }).exec()

      // return any job
      if (jobs.length !== 0) { return jobs[0] }

      await JobModels.Job.deleteOne({ host_id })

      const host = await App.Models.Host.findById(host_id).exec()
      if (!host) { throw new Error('Host not found') }

      const job = new JobModels.AgentUpdate()
      job.host_id = host_id // enforce host_id, just in case
      job.host = host_id // enforce host_id, just in case
      job.customer = host.customer_id
      job.customer_id = host.customer_id
      job.customer_name = host.customer_name
      await job.save()

      logger.log('agent update job created')
      return job
    } catch (err) {
      logger.error(err)
      return err
    }
  },
  finishDummyJob (job, input) {
    return new Promise((resolve, reject) => {
      let { task } = input

      JobFactory.prepareTaskArgumentsValues(
        task.task_arguments,
        input.task_arguments_values,
        (err, args) => {
          if (err) reject(err)

          App.jobDispatcher.finish(Object.assign({}, input, {
            job,
            result: { output: args },
            state: StateConstants[err?'FAILURE':'SUCCESS']
          }), (err) => {
            if (err) reject(err)
            else resolve()
          })
        }
      )
    })
  },
  jobInputsReplenish (job, input, done) {
    let { task, user, customer } = input

    JobFactory.prepareTaskArgumentsValues(
      task.task_arguments,
      input.task_arguments_values,
      (err, args) => {
        if (err) {
          err.statusCode = 400 // input error
          logger.log('%o', err)
          return done(err)
        }

        job.task_arguments_values = args
        job.lifecycle = LifecycleConstants.READY
        job.state = StateConstants.IN_PROGRESS
        job.save(err => {
          if (err) {
            logger.log('%o', err)
            return done(err, job)
          }

          done(null, job) // continue process in paralell

          RegisterOperation(Constants.UPDATE, TopicsConstants.job.crud, { job })
        })
      }
    )
  },
  createByWorkflow (input, next) {
    next || (next=()=>{})
    const { workflow, user, customer } = input

    const createWorkflowJob = (props, done) => {
      let wJob = new JobModels.Workflow(props)
      wJob.save( (err, wJob) => {
        if (err) { return done(err) } // break

        let data = wJob.toObject()
        data.user = {
          id: user.id,
          username: user.username,
          email: user.email
        }

        App.notifications.generateSystemNotification({
          topic: TopicsConstants.job.crud,
          data: {
            organization: customer.name,
            organization_id: customer._id,
            operation: Constants.CREATE,
            model_type: data._type,
            model: data
          }
        })

        done(null, wJob)
      })
    }

    getFirstTask(workflow, (err, task) => {
      if (err) {
        return next(err)
      }

      let wProps = Object.assign({}, input, {
        customer,
        customer_id: customer._id.toString(),
        customer_name: customer.name,
        workflow_id: workflow._id,
        workflow: workflow._id,
        user_id: user.id,
        task_arguments_values: null,
        name: workflow.name
      })

      createWorkflowJob(wProps, (err, wJob) => {
        if (err) { return next(err) }

        const data = Object.assign({}, input, {
          task,
          workflow: input.workflow, // explicit
          workflow_job_id: wJob._id,
          workflow_job: wJob._id
        })

        this.create(data).then(tJob => {
          next(null, wJob)
        }).catch(err => {
          logger.error(err)
          next(err)
        })
      })
    })
  },
  /**
   *
   * @summary parse incomming job output -> input parameters.
   * @return {[String]} array of strings (json encoded strings)
   *
   */
  parseOutputParameters (output) {
    if (typeof output === 'string') {
      return parseOutputStringAsJSON (output)
    } else {
      if (Array.isArray(output)) {
        return filterOutputArray (output)
      } else {
        return [ JSON.stringify(output) ]
      }
    }
  },
  /**
   *
   * @summary Finalize task execution. Save result and submit to elk
   *
   * @param {Object} input
   * @property {Job} input.job
   * @property {Object} input.result
   * @param {Function} done
   *
   */
  async finish (input, done) {
    try {
      const job = input.job
      const result = input.result || {}

      let state, lifecycle, trigger_name
      if (result.killed === true) {
        state = StateConstants.TIMEOUT
        //trigger_name = StateConstants.TIMEOUT
        trigger_name = StateConstants.FAILURE
        lifecycle = LifecycleConstants.TERMINATED
      } else {
        if (input.state) {
          trigger_name = state = input.state
        } else {
          // assuming success
          trigger_name = state = StateConstants.SUCCESS
        }
        lifecycle = LifecycleConstants.FINISHED
      }

      //@TODO: dont remove !!!
      trigger_name = (state === StateConstants.FAILURE) ? StateConstants.FAILURE : StateConstants.SUCCESS

      job.state = state
      job.trigger_name = trigger_name
      job.lifecycle = lifecycle
      job.result = result
      // parse result output
      if (result.output) {
        // data output, can be anything. stringify for security
        let output = result.output
        job.output = this.parseOutputParameters(output)
        job.result.output = (typeof output === 'string') ? output : JSON.stringify(output)
      }

      try {
        let jsonLastline = JSON.parse(result.lastline)
        // looking for state and output
        if (isObject(jsonLastline)) {
          if (jsonLastline.components) {
            job.result.components = jsonLastline.components
          }
        }
      } catch (err) {
        logger.log(err)
      }

      await job.save()
      done(null, job) // continue process in paralell

      process.nextTick(() => {
        RegisterOperation(Constants.UPDATE, TopicsConstants.task.result, { job })
        this.cancelScheduledTimeoutVerificationJob(job)
        dispatchFinishedTaskExecutionEvent(job, job.trigger_name)
      })
    } catch (err) {
      logger.error(err)
      done(err)
    }
  },
  /**
   *
   * @summary Cancel Job execution.
   * Cancel if READY or Terminate if ASSIGNED.
   * Else abort
   *
   * @param {Object} input
   * @property {Job} input.job
   *
   */
  cancel (input, next) {
    next || (next=()=>{})

    const job = input.job
    const result = (input.result || {})

    let lifecycle = cancelJobNextLifecycle(job)
    if (!lifecycle) {
      let err = new Error(`cannot cancel job. current state lifecycle "${job.lifecycle}" does not allow the transition`)
      err.statusCode = 400
      return next(err)
    }

    job.lifecycle = lifecycle
    job.result = result
    job.output = this.parseOutputParameters(result.output)
    job.state = input.state || StateConstants.CANCELED
    job.save(err => {
      if (err) {
        logger.error('fail to cancel job %s', job._id)
        logger.data(job)
        logger.error(err)
        return next(err)
      }

      next(null, job)

      logger.log('job %s terminated', job._id)

      RegisterOperation(Constants.UPDATE, TopicsConstants.task.terminate, { job })
    })
  },
  // automatic job scheduled . send cancelation
  //sendJobCancelationEmail (input) {
  //  const cancelUrl = globalconfig.system.base_url +
  //    '/:customer/task/:task/schedule/:schedule/secret/:secret'

  //  const url = cancelUrl
  //    .replace(':customer', input.customer_name)
  //    .replace(':task', input.task_id)
  //    .replace(':secret', input.task_secret)
  //    .replace(':schedule', input.schedule_id)

  //  const html = `
  //    <h3>Task execution on ${input.hostname} <small>Cancel notification</small></h3>
  //    The task ${input.task_name} will be executed on ${input.hostname} at ${input.date}.<br/>
  //    If you want to cancel the task you have ${input.grace_time_mins} minutes.<br/>
  //    <br/>
  //    To cancel the Task <a href="${url}">press here</a> or copy/paste the following link in the browser of your preference : <br/>${url}<br/>.
  //  `

  //  App.notifications.sendEmailNotification({
  //    customer_name: input.customer_name,
  //    subject: `[TASK] Task ${input.task_name} execution on ${input.hostname} cancelation`,
  //    content: html,
  //    to: input.to
  //  })
  //},
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
      if (err) { return next(err) }
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
  },
  jobMustHaveATask (job) {
    var result = (
      job._type === JobConstants.SCRAPER_TYPE ||
      job._type === JobConstants.SCRIPT_TYPE ||
      job._type === JobConstants.APPROVAL_TYPE ||
      job._type === JobConstants.DUMMY_TYPE
    )
    return result
  },
  /**
   * @param {String} job_id
   * @return {Promise}
   */
  async jobExecutionTimedOut (job_id) {
    let job = await JobModels.Job.findById(job_id).exec()
    if (!job) {
      // finished/removed/canceled
      return
    }

    // still assigned
    if (job.lifecycle === LifecycleConstants.ASSIGNED) {
      let elapsed = (job.timeout + (60 * 1000)) / 1000
      let elapsedText

      if (elapsed > 60) {
        elapsed = elapsed / 60 // mins
        elapsedText = `${elapsed.toFixed(2)} minutes`
      } else {
        elapsedText = `${elapsed.toFixed(2)} seconds`
      }

      App.jobDispatcher.cancel({
        job,
        state: StateConstants.TIMEOUT,
        result: {
          killed: true,
          output: [{ message: `The task was terminated after ${elapsedText} due to execution timeout.` }]
        }
      })
    }

    return
  },
  /**
   * @param {Job} job
   * @return {Promise}
   */
  async scheduleJobTimeoutVerification (job) {
    let defaultTimeout = (10 * 60 * 1000) // 10 minutes in milliseconds
    let timeout = ( job.timeout || defaultTimeout ) + (60 * 1000)
    let now = new Date()
    let when = new Date(now.getTime() + timeout)
    App.scheduler.schedule(when, 'job-timeout', { job_id: job._id.toString() }, null, () => {})
  },
  /**
   * @param {Job} job
   * @return {Promise}
   */
  cancelScheduledTimeoutVerificationJob (job) {
    return App.scheduler.agenda.cancel({
      $and: [
        { name: 'job-timeout' },
        { 'data.job_id': job._id.toString() }
      ]
    })
  }
}

const verifyTaskBeforeExecution = (task) => {
  //let taskData = await App.task.populate(task)
  if (!task.customer) {
    throw new Error(`FATAL. Task ${task._id} does not has a customer`)
  }

  if (taskRequireHost(task) && !task.host) {
    throw new Error(`invalid task ${task._id} does not has a host assigned`)
  }

  return
}

const taskRequireHost = (task) => {
  const res = (
    task.type === TaskConstants.TYPE_SCRIPT ||
    task.type === TaskConstants.TYPE_SCRAPER
  )
  return res
}

const allowedMultitasking = (job, next) => {
  if (
    job._type === JobConstants.NGROK_INTEGRATION_TYPE ||
    job._type === JobConstants.AGENT_UPDATE_TYPE
  ) {
    return next(null, true)
  }

  if (job.task.multitasking !== false) { return next(null, true) }

  JobModels
    .Job
    .findOne({
      task_id: job.task_id,
      _id: { $ne: job._id },
      lifecycle: LifecycleConstants.ASSIGNED
    })
    .exec( (err, inprogressjob) => {
      if (err) {
        logger.error('Failed to fetch inprogress job')
        return next(err)
      }

      next(null, (inprogressjob === null))
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
const removeExceededJobsCount = (task, workflow) => {
  return new Promise( (resolve, reject) => {
    if (task.workflow_id) {
      // only remove workflow jobs when a new one is being created.
      if (
        workflow !== undefined &&
        workflow.start_task_id !== undefined &&
        task._id.toString() === workflow.start_task_id.toString()
      ) {
        removeExceededJobsCountByWorkflow(
          task.workflow_id.toString(),
          task.customer_id,
          resolve
        )
      } else {
        // is a inner workflow job is being created, ignore exceeded jobs
        return resolve()
      }
    } else {
      removeExceededJobsCountByTask(task._id.toString(), resolve)
    }
  })
}

const createJob = (input) => {
  return new Promise((resolve, reject) => {
    const { task } = input

    JobFactory.create(task, input, (err, job) => {
      if (err) { return reject(err) }

      if (job.constructor.name === 'model') {
        logger.log('job created.')
      } else {
        logger.error('invalid job returned.')
        logger.error('%o', job)
        let err = new Error('invalid job returned')
        err.job = job
        return reject(err)
      }

      RegisterOperation(
        Constants.CREATE,
        TopicsConstants.task.execution,
        { job },
        () => {
          if (task.type === TaskConstants.TYPE_DUMMY) {
            if (job.lifecycle !== LifecycleConstants.ONHOLD) {
              App.jobDispatcher.finishDummyJob(job, input).then(resolve).catch(reject)
            } else {
              resolve(job)
            }
          } else if (TaskConstants.TYPE_NOTIFICATION === task.type) {
            App.jobDispatcher.finish(Object.assign({}, input, {
              job,
              result: {},
              state: StateConstants.SUCCESS
            }), (err) => {
              if (err) reject(err)
              else resolve(job)
            })
          } else {
            resolve(job)
          }
        }
      )
    })
  })
}

const createScheduledJob = async (input) => {
  const { customer } = input
  const job = await JobFactory.createScheduledJob(input)

  App.notifications.generateSystemNotification({
    topic: TopicsConstants.job.scheduler.crud,
    data: {
      hostname: (job.host && job.host.hostname) || job.host_id,
      organization: customer.name,
      organization_id: customer._id,
      operation: Constants.CREATE,
      model_type: job._type,
      model: job,
      approvers: (job.task && job.task.approvers) || undefined
    }
  })

  return job
}

const removeExceededJobsCountByTask = (task_id, next) => {
  const LIMIT = JobConstants.JOBS_LOG_COUNT_LIMIT - 1 // docs limit minus 1, because why are going to create the new one after removing older documents
  const Job = JobModels.Job
  Job.countDocuments({ task_id }, (err, count) => {
    if (err) { return next(err) }

    // if count > limit allowed, then search top 6
    // and destroy the 6th and left the others
    if (count > LIMIT) {
      Job
        .find({ task_id })
        .sort({ _id: -1 })
        .limit(LIMIT)
        .exec((err, docs) => {
          let lastDoc = docs[LIMIT - 1]

          // only remove finished jobs
          Job.remove({
            task_id,
            _id: { $lt: lastDoc._id.toString() }, // remove older documents than last
            $and: [
              { lifecycle: { $ne: LifecycleConstants.READY } },
              { lifecycle: { $ne: LifecycleConstants.ASSIGNED } },
              { lifecycle: { $ne: LifecycleConstants.ONHOLD } }
            ]
          }, next)
        })
    } else { return next() }
  })
}

const removeExceededJobsCountByWorkflow = (workflow_id, customer_id, next) => {
  const LIMIT = JobConstants.JOBS_LOG_COUNT_LIMIT
  const Job = JobModels.Job

  let query = Job.aggregate([
    {
      $match: {
        workflow_id,
        customer_id
      }
    }, {
      $group: {
        _id: '$workflow_job_id',
        count: { $sum: 1 },
        jobs: {
          $push: {
            _id: '$_id',
            lifecycle: '$lifecycle'
          }
        }
      }
    }, {
      $match: { _id: { '$ne': null } }
    }, {
      $project: {
        _id: 1,
        finished: {
          $allElementsTrue: {
            $map: {
              input: '$jobs',
              as: 'job',
              in: {
                $or: [
                  { $eq: [ '$$job.lifecycle', LifecycleConstants.FINISHED ] },
                  { $eq: [ '$$job.lifecycle', LifecycleConstants.TERMINATED ] },
                  { $eq: [ '$$job.lifecycle', LifecycleConstants.CANCELED ] },
                  { $eq: [ '$$job.lifecycle', LifecycleConstants.EXPIRED ] },
                  { $eq: [ '$$job.lifecycle', LifecycleConstants.COMPLETED ] }
                ]
              }
            }
          }
        }
      }
    }, {
      $sort: { _id: 1 }
    }
  ])

  query.exec((err, jobs) => {
    if (err) {
      return next(err)
    }

    if (jobs.length > LIMIT) {
      // detect finished tasks
      let disposables = jobs.filter(job => job.finished === true)

      // finished history exceed LIMIT
      if (disposables.length > 0) {
        // remove exceeded items
        let shouldDelete = (jobs.length - LIMIT)

        if (disposables.length <= shouldDelete) {
          // delete whole history
          deleteCount = disposables.length
        } else {
          // delete some
          deleteCount = disposables.length - shouldDelete
        }

        while (deleteCount > 0) {
          let job = disposables[deleteCount - 1]
          Job.remove({
            $or: [
              { workflow_job_id: job._id },
              { _id: mongoose.Types.ObjectId(job._id) }
            ]
          }).exec(err => {
            if (err) {
              logger.err(err)
            }
          })
          --deleteCount
        }
      }
    }

    next()
  })
}

const jobInProgress = (job) => {
  if (!job) {
    return false
  }
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
  let { task_id, output } = job
  let topic

  // cannot trigger a workflow event without a task
  if (!task_id) { return }

  TaskEvent.findOne({
    emitter_id: task_id,
    enable: true,
    name: trigger
  }, (err, event) => {
    if (err) { return logger.error(err) }

    if (!event) {
      let warn = `no handler defined for event named ${trigger} of task ${task_id}`
      return logger.error(warn)
    }

    // trigger task execution event within a workflow
    if (job.workflow_id && job.workflow_job_id) {
      topic = TopicsConstants.workflow.execution
    } else {
      topic = TopicsConstants.task.execution
    }

    App.eventDispatcher.dispatch({
      topic,
      event,
      workflow_job_id: job.workflow_job_id, // current workflow execution
      workflow_id: job.workflow_id,
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

const parseOutputStringAsJSON = (output) => {
  let result
  try { // try to parse as json

    let parsedOutput = JSON.parse(output)
    if (Array.isArray(parsedOutput)) {
      result = filterOutputArray(parsedOutput)
    } else {
      result = [ output ] // object, number, string..
    }

  } catch (e) { // not a valid json string
    result = [ output ]
  }
  return result
}

const filterOutputArray = (outputs) => {
  result = []
  outputs.forEach(val => {
    if (typeof val !== 'string') {
      result.push( JSON.stringify(val) )
    } else {
      result.push(val)
    }
  })
  return result
}

const isObject = (value) => {
  return Object.prototype.toString.call(value) === '[object Object]'
}
