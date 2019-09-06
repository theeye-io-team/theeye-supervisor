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
const NotificationService = require('../../service/notification')
const mongoose = require('mongoose')

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
        if (jobMustHaveATask(job) && !job.task) {
          // cancel invalid job
          job.lifecycle = LifecycleConstants.CANCELED
          job.save(err => {
            if (err) { logger.error('%o', err) }
            dispatchJobExecutionRecursive(++idx, jobs, terminateRecursion)
          })

          registerJobOperation(
            Constants.UPDATE,
            TopicsConstants.task.cancelation,
            {
              job,
              task: job.task,
              user: input.user,
              customer: input.customer
            }
          )
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

              registerJobOperation(
                Constants.UPDATE,
                TopicsConstants.task.sent,
                {
                  job,
                  task: job.task,
                  user: input.user,
                  customer: input.customer
                }
              )
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
      if (err) {
        return done(err)
      }
      removeExceededJobsCount(task, input.workflow, () => {
        JobFactory.create(task, input, (err, job) => {
          if (err) {
            return done(err)
          }

          if (job.constructor.name === 'model') {
            logger.log('job created.')
            let topic = TopicsConstants.task.execution
            registerJobOperation(Constants.CREATE, topic, {
              task,
              job,
              user: input.user,
              customer: input.customer
            }, () => {
              if (TaskConstants.TYPE_DUMMY === task.type) {
                // only Dummy:
                // finish the task at once.
                // bypass inputs to outputs.
                finishDummyTaskJob(job, input, done)
              } else if (TaskConstants.TYPE_NOTIFICATION === task.type) {
                finishNotificationTaskJob(job, input, done)
              } else {
                done(null, job)
              }
            })
          } else if (
            job.agenda &&
            job.agenda.constructor.name === 'Agenda'
          ) { // scheduler agenda job
            logger.log('job scheduled.')
            done(null, job.attrs)
          } else {
            logger.error('invalid job returned.')
            logger.error('%o', job)
          }
        })
      })
    })
  },
  createByWorkflow (input, next) {
    next || (next=()=>{})
    let { workflow, user } = input

    const createWorkflowJob = (props, done) => {
      let wJob = new JobModels.Workflow(props)
      wJob.save( (err, wJob) => {
        if (err) { return done(err) } // break

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

        done(null, wJob)
      })
    }

    getFirstTask(workflow, (err, task) => {
      if (err) {
        return next(err)
      }

      let wProps = Object.assign({}, input, {
        customer: input.customer,
        customer_id: input.customer._id.toString(),
        customer_name: input.customer.name,
        workflow_id: workflow._id,
        workflow: workflow._id,
        user: user._id,
        user_id: user._id,
        task_arguments_values: null,
        name: workflow.name
      })

      createWorkflowJob(wProps, (err, wJob) => {
        if (err) {
          return next(err)
        }

        let data = Object.assign({}, input, {
          task,
          workflow: input.workflow, // explicit
          workflow_job_id: wJob._id,
          workflow_job: wJob._id
        })

        this.create(data, (err, tJob) => {
          if (err) {
            return next(err)
          }
          next(null, wJob)
        })
      })
    })
  },
  /**
   *
   * @summary parse incomming job input parameters.
   * @return {[String]} array of strings (json encoded strings)
   *
   */
  parseJobParameters (output) {
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
    let state = (input.state || StateConstants.SUCCESS)
    let trigger_name = (state === StateConstants.FAILURE) ?
      StateConstants.FAILURE : StateConstants.SUCCESS

    // data output, can be anything. stringify for security
    job.result = result
    job.state = state
    job.trigger_name = trigger_name
    job.lifecycle = (job.result.killed === true) ? LifecycleConstants.TERMINATED : LifecycleConstants.FINISHED

    // parse result output
    if (job.result.output) {
      let output = job.result.output
      job.output = this.parseJobParameters(output)
      job.result.output = (typeof output === 'string') ? output : JSON.stringify(output)
    }

    job.save(err => {
      if (err) {
        logger.log('%o', err)
        return done(err, job)
      }

      done(null, job) // continue process in paralell

      let topic = TopicsConstants.task.result
      registerJobOperation(Constants.UPDATE, topic, {
        job, user, customer, task
      })

      dispatchFinishedTaskExecutionEvent(job, trigger_name)
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
    if (err) { return next(err) }

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

const allowedMultitasking = (job, next) => {
  //if (job.name==='agent:config:update') { return next(null, true) }
  if (
    job._type === 'NgrokIntegrationJob' ||
    job._type==='AgentUpdateJob'
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
const removeExceededJobsCount = (task, workflow, next) => {
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
        next
      )
    } else {
      // is a inner workflow job is being created, ignore exceeded jobs
      return next()
    }
  } else {
    removeExceededJobsCountByTask(task._id.toString(), next)
  }
}

const removeExceededJobsCountByTask = (task_id, next) => {
  const LIMIT = JobConstants.JOBS_LOG_COUNT_LIMIT - 1 // docs limit minus 1, because why are going to create the new one after removing older documents
  const Job = JobModels.Job
  Job.count({ task_id }, (err, count) => {
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
const registerJobOperation = (operation, topic, input, done) => {
  done || (done = () => {})
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
      job._type !== JobConstants.DUMMY_TYPE &&
      job._type !== JobConstants.NOTIFICATION_TYPE
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
    } else if (job._type == JobConstants.NOTIFICATION_TYPE) {
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
        approvers: (job.task && job.task.approvers) || undefined
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
    done()
  })
}

//const finishJobNextLifecycle = (job) => {
//  if (
//    job.lifecycle === LifecycleConstants.READY ||
//    job.lifecycle === LifecycleConstants.ONHOLD
//  ) {
//    return LifecycleConstants.CANCELED
//  } else if (job.lifecycle === LifecycleConstants.ASSIGNED) {
//    return LifecycleConstants.TERMINATED
//  } else {
//    // current state cannot be canceled or terminated
//    return null
//  }
//}

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
  let { task_id, output } = job
  let topic

  // cannot trigger a workflow event without a task
  if (!task_id) { return }

  TaskEvent.findOne({
    emitter_id: task_id,
    enable: true,
    name: trigger
  }, (err, event) => {
    if (err) {
      return logger.error(err)
    }

    if (!event) {
      var err = new Error('no handler defined for event named "' + trigger + '" on task ' + task_id)
      return logger.error(err)
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

const finishDummyTaskJob = (job, input, done) => {
  let { task } = input

  JobFactory.prepareTaskArgumentsValues(
    task.output_parameters,
    input.task_arguments_values,
    (err, args) => {
      let specs = Object.assign({}, input, {
        job,
        result: { output: args },
        state: StateConstants[err?'FAILURE':'SUCCESS']
      })

      App.jobDispatcher.finish(specs, done)
    }
  )
}

const finishNotificationTaskJob = (job, input, done) => {
  let specs = Object.assign({}, input, {
    job,
    result: {},
    state: StateConstants['SUCCESS']
  })
  App.jobDispatcher.finish(specs, done)
}

//const createNotificationJobPayload = (data) => {
//  let args = data.task_arguments_values
//  let subject
//  let body
//  let recipients
//
//  if (Array.isArray(args) && args.length === 3) {
//    subject = (args[0] || data.task.subject)
//    body = (args[1] || data.task.body)
//    recipients = (args[2] || data.task.recipients)
//  } else {
//    subject = data.task.subject
//    body = data.task.body
//    recipients = data.task.recipients
//  }
//
//  let payload = {
//    topic: TopicsConstants.task.notification,
//    data: {
//      organization: data.customer.name,
//      operation: Constants.CREATE,
//      model_type: JobConstants.NOTIFICATION_TYPE,
//      notificationTypes: data.task.notificationTypes,
//      model: {
//        task: {
//          subject,
//          body,
//          recipients,
//          acl: data.task.acl,
//          name: data.task.name
//        },
//        _type: JobConstants.NOTIFICATION_TYPE,
//        id: data.job.id
//      }
//    }
//  }
//
//  return payload
//}
