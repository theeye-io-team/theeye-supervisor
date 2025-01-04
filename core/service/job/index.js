const App = require('../../app')
const logger = require('../../lib/logger')('service:jobs')
const Constants = require('../../constants')
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const TaskConstants = require('../../constants/task')
const TopicsConstants = require('../../constants/topics')
const StateConstants = require('../../constants/states')
const JobFactory = require('./factory')
const mongoose = require('mongoose')
const RegisterOperation = require('./register')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = {
  hasFinished (job) {
    return (
      job.lifecycle === LifecycleConstants.FINISHED ||
      job.lifecycle === LifecycleConstants.TERMINATED ||
      job.lifecycle === LifecycleConstants.CANCELED ||
      job.lifecycle === LifecycleConstants.EXPIRED ||
      job.lifecycle === LifecycleConstants.COMPLETED
    )
  },
  fetchBy (filter, next) {
    return App.Models.Job.Job.fetchBy(filter, (err, jobs) => {
      if (err) {
        return next(err)
      }
      if (jobs.length === 0) {
        return next(null, [])
      }
      next(null, jobs)
    })
  },
  async getJobsByTask (input) {
    const { task, customer } = input

    const limit = (input.limit || 1)

    if (task.multitasking === false) {
      // @TODO MongoDB index creation
      const job = await App.Models.Job
        .Job
        .findOne({
          task_id: task._id,
          lifecycle: LifecycleConstants.ASSIGNED
        })

      if (job) {
        return []
      }
    }

    // @TODO MongoDB index creation for this $match and $sort
    const jobs = await App.Models.Job.Job.aggregate([
      {
        $match: {
          task_id: task._id.toString(),
          lifecycle: LifecycleConstants.READY
        }
      },
      {
        $sort: {
          creation_date: 1
        }
      },
      {
        $limit: limit
      }
    ])

    if (jobs.length === 0) {
      return []
    }

    const models = []
    for (let index = 0; index < jobs.length; index++) {
      const job = App.Models.Job.Job.hydrate(jobs[index])
      job.lifecycle = LifecycleConstants.ASSIGNED
      await job.save()

      RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job })
      models.push(job)
    }

    return models
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
    if (!input.host) { return next(new Error('host is required')) }

    /**
     *
     * NOTE: jobs is an array of job data, there are NOT job models
     * cannot use job.save since jobs are not mongoose document
     *
     */
    //let jobs = []
    const dispatchJobExecutionRecursive = async (idx, jobs, terminateRecursion) => {
      let job
      try {
        if (idx === jobs.length) {
          return terminateRecursion()
        }

        job = App.Models.Job.Job.hydrate(jobs[idx])

        // Cancel this job and process next
        if (App.jobDispatcher.jobMustHaveATask(job) && !job.task) {
          // cancel invalid job
          job.lifecycle = LifecycleConstants.CANCELED
          await job.save()
          RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job })
          // continue loop
          return dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
        } else {
          const multitasking = await allowedMultitasking(job)
          if (!multitasking) {
            // skip this one
            return dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
          }

          logger.log(`Dispatching job ${job.id}: ${job.name}`)
          const result = await App.Models.Job.Job.findOneAndUpdate(
            { _id: job._id, lifecycle: LifecycleConstants.READY },
            { lifecycle: LifecycleConstants.ASSIGNED },
            { rawResult: true, new: true }
          )

          if (!result) { throw new ServerError('query failed') }

          if (result.lastErrorObject?.updatedExisting !== true) {
            throw new ServerError(`Job ${job.id}: ${job.name} already dispatched`)
          }

          // set workflow as started
          if (job.workflow_job_id) {
            await App.Models.Job.Job.findOneAndUpdate(
              {
                _id: job.workflow_job_id,
                lifecycle: { $ne: LifecycleConstants.STARTED }
              },
              { lifecycle: LifecycleConstants.STARTED }
            )
          }

          const updatedJob = result.value

          terminateRecursion(null, updatedJob)
          RegisterOperation.submit(
            Constants.UPDATE,
            TopicsConstants.job.crud,
            { job: updatedJob }
          )

          if (job.workflow_job_id) {
            await updatedJob.populate([
              { path: 'workflow_job' },
            ]).execPopulate()

            RegisterOperation.workflowSubmit(
              Constants.UPDATE,
              TopicsConstants.workflow.job.crud,
              { job: updatedJob.workflow_job }
            )
          }
        }
      } catch (err) {
        logger.error(`Job ${job?.id}: ${job?.name} cannot be dispatched`)
        logger.error('%s', err)
        return dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
      }
    }

    this.queryJobsQueuesByHost(input.host._id.toString())
      .then(queues => {
        if (queues.length > 0) {
          let idx = 0
          const jobs = queues.map(q => q.nextJob)
          dispatchJobExecutionRecursive(idx, jobs, next)
        } else {
          next()
        }
      }).catch(err => {
        logger.error('%o',err)
        return next(err)
      })
  },
  queryJobsQueuesByHost (host_id) {
    return App.Models.Job.Job.aggregate([
      {
        $match: {
          host_id,
          lifecycle: LifecycleConstants.READY
        }
      },
      {
        $addFields: {
          queue_id: { $ifNull: [ "$workflow_id", "$task_id" ] }
        }
      },
      {
        $sort: {
          queue_id: 1,
          order: 1
        }
      },
      // given the defined order use it to determine which is the next job of the queue to execute
      {
        $group: {
          _id: '$queue_id',
          nextJob: {
            $first: '$$ROOT'
          }
        }
      },
      // sort queues by FIFO. dispatch older first
      {
        $sort: {
          "nextJob.creation_date": 1
        }
      }
    ]).exec()
  },
  getAgentUpdateJob (host, next) {
    App.Models.Job.AgentUpdate.findOne({
      host_id: host._id,
      lifecycle: LifecycleConstants.READY
    }, (err, job) => {
      if (err) {
        logger.error('%s', err)
        return next(err)
      }
      if (!job) { return next() }

      job.lifecycle = LifecycleConstants.ASSIGNED
      job.save(err => {
        if (err) {
          logger.error('%s', err)
        }
        next(err, job)
      })
    })
  },
  async finishNotificationJob (job, input) {
    return new Promise(async (resolve, reject) => {
      const args = job.task_arguments_values
      const task = job.task
      const subject = args[0] || task?.subject
      const message = args[1] || task?.body
      const recipients = parseRecipients(args[2]) || task?.recipients

      job.task_arguments_values = [ subject, message, recipients ]
      await job.save()

      App.notifications.generateTaskNotification({
        topic: TopicsConstants.task.notification,
        data: {
          subject,
          recipients,
          message,
          notificationTypes: task?.notificationTypes,
          operation: Constants.CREATE,
          organization: job.customer_name,
          organization_id: job.customer_id,
          model_id: job._id,
          model_type: job._type,
          model: {
            _id: job._id.toString(),
            _type: job._type,
            id: job._id.toString(),
            type: job.type,
            name: job.name,
            user_id: job.user_id,
            acl: job.acl,
            workflow_id: job.workflow_id,
            workflow_job_id: job.workflow_job_id,
            task_id: job.task_id,
            task: {
              id: job.task_id?.toString(),
              _id: job.task_id?.toString(),
            }
          }
        }
      })

      App.jobDispatcher.finish(Object.assign({}, input, {
        job,
        result: {},
        state: StateConstants.SUCCESS
      }), (err) => {
        if (err) reject(err)
        else resolve(job)
      })
    })
  },
  finishDummyJob (job, input) {
    return new Promise((resolve, reject) => {
      let { task } = input

      JobFactory.prepareTaskArgumentsValues(
        task.arguments_type,
        task.task_arguments,
        input.task_arguments_values,
        (err, args) => {
          if (err) {
            return reject(err)
          }

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
  finishWorkflowJob (wfjob, input) {
    wfjob.lifecycle = input.lifecycle
    wfjob.state = input.state
    wfjob.trigger_name = (input.trigger_name || input.state)
    wfjob.save()
    this.finishedWorkflowPostprocessing({ job: wfjob })
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
      const { job, user, result = {} } = input
      //const result = (input.result ||{})

      let state
      let lifecycle
      let eventName

      if (result.killed === true) {
        lifecycle = LifecycleConstants.TERMINATED
        state = StateConstants.TIMEOUT
        eventName = StateConstants.TIMEOUT
      } else if (input.state === StateConstants.CANCELED) {
        state = StateConstants.CANCELED
        eventName = StateConstants.CANCELED
        lifecycle = cancelJobNextLifecycle(job)
      } else {
        lifecycle = LifecycleConstants.FINISHED
        if (
          input.state === StateConstants.SUCCESS ||
          input.state === StateConstants.FAILURE
        ) {
          state = input.state
        } else {
          // assuming success for backward compatibility
          state = (job.task?.default_state_evaluation || StateConstants.SUCCESS)
        }
      }

      job.lifecycle = lifecycle
      job.state = state
      job.result = result
      // parse result output
      if (result.output) {
        // data output, can be anything. stringify for security reason
        job.output = this.parseOutputParameters(result.output)
        //job.result.output = (typeof output === 'string') ? output : JSON.stringify(output)
      }

      if (result.lastline) {
        try {
          const jsonLastline = JSON.parse(result.lastline)
          // looking for state and output
          if (isObject(jsonLastline)) {
            if (jsonLastline.components) {
              job.components = jsonLastline.components
            }
            if (jsonLastline.next) {
              job.next = jsonLastline.next
            }
            if (jsonLastline.event_name) {
              eventName = jsonLastline.event_name
            }
          }
        } catch (err) {
          //logger.log(err)
        }
      } else if (input.eventName) {
        eventName = input.eventName
      }

      job.trigger_name = (eventName || state)

      await job.save()

      this.finishedPostprocessing({ job, user })

      done(null, job)
    } catch (err) {
      logger.error(err)
      done(err)
    }
  },
  finishedWorkflowPostprocessing ({ job }) {
    process.nextTick(() => {
      RegisterOperation.submit(
        Constants.UPDATE,
        TopicsConstants.workflow.job.crud,
        { job }
      )

      dispatchFinishedWorkflowJobExecutionEvent(job)
      emitJobFinishedNotification({
        job,
        topic: TopicsConstants.workflow.job.finished
      })
    })
  },
  finishedPostprocessing ({ job, user }) {
    process.nextTick(() => {
      RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job, user })
      App.scheduler.cancelScheduledTimeoutVerificationJob(job) // async
      dispatchFinishedTaskJobExecutionEvent(job)
      emitJobFinishedNotification({ job })
    })
  },
  /**
   * @return {Promise<Job>}
   */
  async restart (input) {
    const { job } = input

    job.trigger_name = null
    job.result = {}
    job.output = {}

    if (job.workflow_job_id) {
      await App.Models.Job.Workflow.setActivePaths(job.workflow_job_id, 1)
    }

    return this.jobInputsReplenish(input)
  },
  /**
   * @return {Promise<Job>}
   */
  async jobInputsReplenish (input) {
    const { job, user } = input

    await JobFactory.restart(input)

    // everything ok
    RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job, user })

    return job
  },
  /**
   *
   * Change job lifecycle from syncing to ready.
   *
   * @param {Job} job
   * @return {Promise<Job>}
   */
  async syncingToReady (job) {
    job.lifecycle = LifecycleConstants.READY
    job.state = StateConstants.IN_PROGRESS
    await job.save()
    RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job })
    return job
  },
  /**
   *
   * Hold job if it is not assigned
   *
   * @param {Job} job
   * @return {Promise<Job>}
   */
  async holdExecution (job) {
    let result = await App.Models.Job.Job.findOneAndUpdate(
      { _id: job._id },
      { lifecycle: LifecycleConstants.ONHOLD, state: StateConstants.IN_PROGRESS },
      { rawResult: true, new: true }
    )

    const updatedJob = result.value

    if (job.workflow_job) {
      result = await App.Models.Job.Job.findOneAndUpdate(
        { _id: job.workflow_job_id },
        { lifecycle: LifecycleConstants.ONHOLD },
        { rawResult: true, new: true }
      )

      const wfJob = result.value
      RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job:wfJob })
    }

    RegisterOperation.submit(Constants.UPDATE, TopicsConstants.job.crud, { job })
    return job
  },
  /**
   * @param {Object} input
   * @property {Task} input.task
   * @property {User} input.user
   * @property {Customer} input.customer
   * @property {Boolean} input.notify
   * @property {String[]} input.task_arguments_values arguments definitions
   * @property {ObjectId} input.workflow_job_id current workflow ejecution
   * @property {ObjectId} input.workflow_job
   * @property {Workflow} input.workflow optional
   */
  async create (input) {
    const { task, workflow, workflow_job } = input
    let job

    if (!task) {
      throw new ClientError('task is required')
    }

    verifyTaskBeforeExecution(task)

    if (
      task.grace_time > 0 && ( // automatic origin
        input.origin === JobConstants.ORIGIN_WORKFLOW ||
        input.origin === JobConstants.ORIGIN_TRIGGER_BY
      )
    ) {
      job = await scheduleJob(input) // agenda job
    } else {
      job = await createJob(input)
    }

    await dispatchJobCreatedEvent(job, input)

    if (workflow) {
      // only available when the workflow is started
      if (workflow_job) {
        workflow_job.active_paths_counter = 1 // there ir only one active path
        await App.Models.Job.Workflow.setActivePaths(workflow_job._id, 1)
      }

      if (workflow.autoremove_completed_jobs !== false) {
        removeExceededJobsCountByWorkflow(workflow, task)
      }
    } else if (task.autoremove_completed_jobs !== false) {
      removeExceededJobsCountByTask(task)
    }

    return job
  },
  /**
   *
   * @param Object input
   * @prop Workflow
   * @prop User
   * @prop Customer
   * @prop Task
   *
   */
  async createByWorkflow (input) {
    const { workflow, user, customer } = input

    // if task is not specified , then use workflow starting task
    let task = input.task
    if (!task) {
      let taskId = workflow.start_task_id
      task = await App.Models.Task.Task.findById(taskId)
      if (!task) {
        throw new Error('workflow first task not found. cannot execute')
      }
    }

    input.order = await getWorkflowJobsOrder(workflow)
    const job = await JobFactory.createWorkflowJob(input)

    // send and wait before creating the job of the first task
    // to ensure dispatching events in order

    await WorkflowJobCreatedNotification({ job, customer })

    // create first task job
    await this.create(
      Object.assign({}, input, {
        task,
        workflow: input.workflow, // explicit
        workflow_job_id: job._id,
        workflow_job: job
      })
    )

    return job
  },
  async createAgentUpdateJob (host_id) {
    if (!host_id) { return null }

    const host = await App.Models.Host.Entity.findById(host_id)
    if (!host) {
      throw new Error('Host not found')
    }

    // check if there are update jobs already created for this host
    const jobs = await App.Models.Job.AgentUpdate.find({
      name: JobConstants.AGENT_UPDATE,
      host_id,
      lifecycle: LifecycleConstants.READY
    })

    // return any job
    if (jobs.length !== 0) {
      return jobs[0]
    }

    await App.Models.Job
      .AgentUpdate
      .deleteMany({
        host_id,
        name: JobConstants.AGENT_UPDATE
      })

    const job = new App.Models.Job.AgentUpdate()
    job.host_id = host_id // enforce host_id, just in case
    job.host = host_id // enforce host_id, just in case
    job.customer = host.customer_id
    job.customer_id = host.customer_id
    job.customer_name = host.customer_name
    await job.save()

    logger.log('agent update job created')
    return job
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
   * @summary Cancel Job execution.
   * Cancel if READY or Terminate if ASSIGNED.
   * Else abort
   *
   * @param {Object} input
   * @property {Job} input.job
   *
   */
  async cancel (input, next) {
    try {
      next || (next=()=>{})

      const { job, user, state } = input
      const result = (input.result ||{})

      const lifecycle = cancelJobNextLifecycle(job)
      if (!lifecycle) {
        throw new ClientError(`cannot cancel job. current state lifecycle "${job.lifecycle}" does not allow the transition`)
      }

      job.lifecycle = lifecycle
      job.state = StateConstants.CANCELED
      job.trigger_name = StateConstants.CANCELED
      job.result = result
      job.output = this.parseOutputParameters(result.output)
      await job.save()

      this.finishedPostprocessing({ job, user })

      next(null, job)
    } catch (err) {
      next(err)
    }
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
  async jobExecutionTimedOutCheck (job_id) {
    let job = await App.Models.Job.Job.findById(job_id)
    if (!job) {
      // finished / removed / canceled
      return null
    }

    // is still assigned and waiting execution result
    if (job.lifecycle === LifecycleConstants.ASSIGNED) {
      let elapsed = (job.timeout + (60 * 1000)) / 1000
      let elapsedText

      if (elapsed > 60) {
        elapsed = elapsed / 60 // mins
        elapsedText = `${elapsed.toFixed(2)} minutes`
      } else {
        elapsedText = `${elapsed.toFixed(2)} seconds`
      }

      return new Promise( (resolve, reject) => {
        this.cancel({
          job,
          state: StateConstants.TIMEOUT,
          result: {
            killed: true,
            output: [{ message: `The task was terminated after ${elapsedText} due to execution timeout.` }]
          }
        }, err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    return null // undefined
  },
  updateWorkflowJobsAcls (wfJob, acl) {
    const promise = App.Models.Job.Job
      .find({ workflow_job_id: wfJob._id })
      .then(jobs => {

        const savePromises = []
        if (jobs.length > 0) {
          for (let job of jobs) {
            job.acl = acl
            savePromises.push(job.save())
          }
        }

        return Promise.all(savePromises)
      })
      .then(saved => {
        logger.log(`${saved.length} jobs updated`)
        return saved
      })
      .catch(err => {
        logger.error(err)
        return err
      })

    return promise
  }
}

/**
 *
 * @return {Promise}
 *
 */
const getWorkflowJobsOrder = (workflow) => {
  const count = App.Models
    .Job
    .Workflow
    .findOne({ workflow_id: workflow._id }, 'order')
    .sort({ order: -1 })

  // promise
  return count.exec().then(job => job?job.order + 1:0)
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

const allowedMultitasking = async (job) => {
  if (job._type === JobConstants.AGENT_UPDATE_TYPE) {
    return true
  }

  let query
  if (job.workflow_job) {
    await populateWorkflow(job)
    if (job.workflow.multitasking !== false) {
      return true
    }

    query = {
      workflow_id: job.workflow_id,
      _type: JobConstants.WORKFLOW_TYPE,
      _id: {
        $ne: job.workflow_job_id
      },
      lifecycle: LifecycleConstants.STARTED
    }

  } else {
    if (job.task.multitasking !== false) {
      return true
    }

    // identify in progress jobs of the same task
    query = {
      task_id: job.task_id,
      _id: {
        $ne: job._id
      },
      lifecycle: {
        // in progress lifecycles
        $in: [
          LifecycleConstants.ASSIGNED,
        ]
      }
    }
  }

  const inprogressjob = await App.Models.Job.Job.findOne(query).exec()
  return (inprogressjob === null)
}

const populateWorkflow = async (job) => {
  if (job.workflow) {
    return job.populate({
      path: 'workflow',
      select: 'multitasking'
    }).execPopulate()
  } else {
    return
  }
}

/**
 * Invoke Job Factory (immediate execution)
 * @param {Object} input
 */
const createJob = async (input) => {
  try {
    const { task, user } = input

    const job = await JobFactory.create(task, input)

    if (!job) {
      throw new Error('Job was not created')
    }

    if (job.constructor.name !== 'model') {
      const err = new Error('Invalid job returned')
      err.job = job
      throw err
    }

    logger.log('job created.')

    // await notification and logs generation
    await RegisterOperation.submit(Constants.CREATE, TopicsConstants.job.crud, { job, user })

    return job
  } catch (err) {
    logger.error(err)
  }
}

/**
 * Invoke Job Factory (scheduled, delayed execution)
 *
 * @param {Object} input
 */
const scheduleJob = async (input) => {
  const { customer, user } = input
  const job = await JobFactory.createScheduledJob(input)

  const topic = TopicsConstants.schedule.crud
  const operation = Constants.CREATE

  App.notifications.generateSystemNotification({
    topic,
    data: {
      operation,
      organization: customer.name,
      organization_id: customer._id,
      model: job // AGENDA JOB !!
      //model_id: job._id,
      //model_type: job._type,
    }
  })

  const payload = {
    operation,
    organization: customer.name,
    organization_id: customer._id,
    model: job,
    user_id: (user?.id||null),
    user_email: (user?.email||null),
    user_name: (user?.username||null)
  }

  App.logger.submit(customer.name, topic, payload)

  return job
}

const removeExceededJobsCountByTask = async (task) => {
  const limit = (task.autoremove_completed_jobs_limit || JobConstants.JOBS_LOG_COUNT_LIMIT)

  const task_id = task._id.toString()
  const count = await App.Models.Job.Job.countDocuments({ task_id })

  // if count > limit allowed, then search top ${limit}
  // destroy the oldest jobs
  if (count > limit) {
    const jobs = await App.Models.Job.Job
      .find({ task_id })
      .sort({ _id: -1 })
      .limit(limit)

    if (limit === jobs.length) { // we got the ammount of jobs we asked for
      const lastDoc = jobs[limit - 1]
      // only remove finished jobs
      const result = await App.Models.Job.Job.remove({
        task_id,
        _id: { $lt: lastDoc._id.toString() }, // remove the oldest than the last documents
        $and: [
          { lifecycle: { $ne: LifecycleConstants.LOCKED } },
          { lifecycle: { $ne: LifecycleConstants.SYNCING } },
          { lifecycle: { $ne: LifecycleConstants.READY } },
          { lifecycle: { $ne: LifecycleConstants.ASSIGNED } },
          { lifecycle: { $ne: LifecycleConstants.ONHOLD } }
        ]
      })

      logger.debug(`${result.deletedCount} task-jobs logs removed`)
    }
  }
}

const removeExceededJobsCountByWorkflow = async (workflow, task) => {
  // remove jobs only if launching new workflows
  if (task._id.toString() !== workflow.start_task_id.toString()) {
    return
  }

  const workflow_id = workflow._id.toString()
  const limit = (workflow.autoremove_completed_jobs_limit || JobConstants.JOBS_LOG_COUNT_LIMIT)

  const count = await App.Models.Job.Job.countDocuments({
    workflow_id,
    _type: JobConstants.WORKFLOW_TYPE
  })

  if (count <= limit) {
    return
  }

  App.Models.Job
    .Job
    .aggregate([
      {
        $match: {
          workflow_id,
          customer_id: workflow.customer_id.toString() // just in case
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
      }, {
        $match: { finished: true }
      }
    ])
    .exec()
    .then(jobs => actuallyRemoveWorkflowJobs(jobs, limit))
    .catch(err => logger.error(err) )

  // don't wait
  return
}

const actuallyRemoveWorkflowJobs = async (jobs, limit) => {
  if (jobs.length > limit) {

    // remove exceeded items
    const shouldDeleteCount = (jobs.length - limit)
    logger.log(`deleting ${shouldDeleteCount} of ${jobs.length} exceeded jobs`)

    // detect finished tasks
    const canDelete = jobs.filter(job => job.finished === true)

    // finished history exceed limit
    if (canDelete.length > 0) {

      if (canDelete.length > shouldDeleteCount) {
        deleteCount = shouldDeleteCount
      } else {
        deleteCount = canDelete.length // delete all of them
      }

      const promises = []
      while (deleteCount > 0) {
        let job = canDelete[deleteCount - 1]

        // delete individual workflow job first
        const wfpromise = App.Models.Job
          .Workflow
          .deleteOne({
            _id: mongoose.Types.ObjectId(job._id)
          })
          .then(deleted => {
            logger.log(`[${job._id}]: ${deleted.deletedCount} deleted wf job`)
            return deleted
          })
          .catch(err => {
            logger.error('%o', err)
            return `Error: ${err.message}`
          })

        promises.push(wfpromise)

        // delete task-jobs of this workflow-job
        const tjobpromise = App.Models.Job
          .Job
          .deleteMany({
            _type: { $ne: 'WorkflowJob' }, // just in case...
            workflow_job_id: job._id 
          })
          .then(deleted => {
            logger.log(`[${job._id}]: ${deleted.deletedCount} deleted task jobs`)
            return deleted
          })
          .catch(err => {
            logger.error('%o', err)
            return `Error: ${err.message}`
          })

        promises.push(tjobpromise)

        --deleteCount
      }

      Promise.all(promises).then(result => {
        logger.debug(`${promises.length} operations performed`)
        logger.debug(result)
        return result
      })
    }
  }
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
    // job is done. cannot be canceled or terminated
    return null
  }
}

/**
 *
 * @summary Job execution finished.
 * @param {Job} job
 * @param {Object} data
 * @return {Promise}
 *
 */
const dispatchFinishedTaskJobExecutionEvent = async (job) => {
  try {
    const { task_id, trigger_name } = job

    if (!task_id) {
      throw new Error('cannot trigger a job event without a task')
      return
    }

    let event = await App.Models.Event.TaskEvent.findOne({
      emitter_id: task_id,
      enable: true,
      name: trigger_name
    })

    if (!event) {
      //event.id = uuidv4()
      event = new App.Models.Event.TaskEvent({
        emitter_id: task_id,
        name: trigger_name,
        creation_date: new Date(),
        last_update: new Date()
      })
    }

    const data = getJobResult(job)
    const topic = TopicsConstants.job.finished
    App.eventDispatcher.dispatch({ topic, event, data, job })
  } catch (err) {
    if (err) {
      return logger.error(err)
    }
  }
}

const dispatchJobCreatedEvent = async (job, input) => {
  try {
    const { task_id, trigger_name } = job

    if (!task_id) {
      throw new Error('cannot trigger a job event without a task')
      return
    }

    //let event = await App.Models.Event.TaskEvent.findOne({
    //  emitter_id: task_id,
    //  enable: true,
    //  name: trigger_name
    //})

    //event.id = uuidv4()
    const event = new App.Models.Event.TaskEvent({
      emitter_id: task_id,
      name: Constants.CREATE,
      //name: trigger_name,
      creation_date: new Date(),
      last_update: new Date()
    })

    const topic = TopicsConstants.job.crud
    App.eventDispatcher.dispatch({ topic, event, data: input, job })
  } catch (err) {
    if (err) {
      return logger.error(err)
    }
  }
}

const dispatchFinishedWorkflowJobExecutionEvent = async (job) => {
  try {
    const { workflow_id, trigger_name } = job

    // on the fly
    const event = new App.Models.Event.WorkflowEvent({
      emitter_id: workflow_id,
      name: trigger_name,
      creation_date: new Date(),
      last_update: new Date()
    })

    const topic = TopicsConstants.workflow.job.finished
    App.eventDispatcher.dispatch({ topic, event, data: {}, job })
  } catch (err) {
    if (err) {
      return logger.error(err)
    }
  }
}

const getJobResult = (job) => {
  let result = job.output
  try {
    if (job._type === JobConstants.SCRAPER_TYPE) {
      result[1] = JSON.stringify(job.result.response?.headers)
      result[2] = Number(job.result.response?.status_code)
    }
  } catch (err) {
  }

  return result
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

/**
 * @return {Promise}
 */
const WorkflowJobCreatedNotification = ({ job, customer }) => {
  return App.notifications.generateSystemNotification({
    topic: TopicsConstants.job.crud,
    data: {
      operation: Constants.CREATE,
      organization: customer.name,
      organization_id: customer._id,
      model_id: job._id,
      model_type: job._type,
      model: RegisterOperation.jobToEventModel(job)
    }
  })
}

/**
 *
 * Required by the Sync API
 *
 * Emit the event "job finished execution" after all possible outcomes.
 *
 * @return {Promise}
 *
 */
const emitJobFinishedNotification = ({ job, topic = TopicsConstants.job.finished }) => {
  // async call
  return App.notifications.generateSystemNotification({
    topic,
    data: {
      operation: Constants.UPDATE,
      organization: job.customer_name,
      organization_id: job.customer_id,
      model_id: job._id,
      model_type: job._type,
      model: RegisterOperation.jobToEventModel(job)
    }
  })
}

const parseRecipients = (values) => {
  let recipients = null

  if (!values) { return recipients }

  try {
    if (typeof values === 'string') {
      let parsed = values.toLowerCase()
      // email or username, single or array
      parsed = JSON.parse(values)

      if (Array.isArray(parsed) && parsed.length > 0) {
        recipients = parsed
      } else {
        recipients = [ parsed ]
      }
    }
  } catch (jsonErr) {
    logger.log(jsonErr.message)
    logger.log(values)

    const parts = values.split(',')
    if (parts.length > 1) {
      recipients = parts
    } else {
      recipients = [ values ]
    }
  }

  return recipients
}
