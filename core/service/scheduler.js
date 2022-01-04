
const Agenda = require('agenda')
const ObjectId = require('mongoose').Types.ObjectId
const EventEmitter = require('events').EventEmitter
const util = require('util')

const App = require('../app')
const logger = require('../lib/logger')(':scheduler')
const mongodb = require('../lib/mongodb').connection.db

const SchedulerConstants = require('../constants/scheduler')
const JobConstants = require('../constants/jobs')
const LifecycleConstants = require('../constants/lifecycle')

function Scheduler () {
  EventEmitter.call(this)

  // use the default mongodb connection
  this.agenda = new Agenda({
    mongo: mongodb,
    defaultConcurrency: 50,
    maxConcurrency: 200
  })
}

// give the scheduler the hability to emit events
util.inherits(Scheduler, EventEmitter)

Scheduler.prototype = {
  initialize (config) {
    return new Promise((resolve, reject) => {
      let agenda = this.agenda

      agenda.on('ready', () => {
        logger.log('Scheduler API is connected')

        if (config.enabled !== true) {
          logger.warn('WARNING! Scheduler JOBS are disabled by config')
        } else if (process.env.SCHEDULER_JOBS_DISABLED === 'true') {
          logger.warn('WARNING! Scheduler JOBS are disabled by ENV: SCHEDULER_JOBS_DISABLED="true"')
        } else {
          logger.log('Preparing scheduler jobs queues')
          setupAgendaJobs(agenda)
        }

        resolve()
      })

      agenda.start()
    })
  },
  /**
   * schedules a task
   * @param {Object} input data
   * @property {String} input.origin job schedule creator
   * @property {Task} input.task the task definition
   */
  async scheduleTask (input, done) {
    try {
      const task = input.task
      const customer = input.customer
      const user = input.user
      // runDate is in miliseconds
      const { runDate, repeatEvery, timezone } = input

      const data = {
        task_id: task._id,
        customer_id: customer._id,
        notify: (input.notify || false),
        scheduleData: { runDate, repeatEvery, timezone },
        origin: input.origin
      }

      const job = await this.createSchedulerJob({
        name: SchedulerConstants.AGENDA_TASK,
        data,
        starting: new Date(runDate),
        interval: repeatEvery,
        timezone
      })
      return done(null, job)
    } catch (err) {
      return done(err)
    }
  },
  /**
   * Schedule a Workflow
   *
   * @param {Object}
   * @property {String} origin
   * @property {Workflow} workflow
   * @property {User} user
   * @property {Customer} customer
   * @property {Date} runDate milliseconds
   * @property {String} repeatEvery
   * @property {Boolean} notify
   * @return {Promise} agenda job schedule promise
   */
  scheduleWorkflow ({ origin, workflow, customer, notify, runDate, repeatEvery, timezone }) {
    const data = {
      workflow_id: workflow._id,
      customer_id: customer._id,
      notify: (notify || false),
      scheduleData: { runDate, repeatEvery, timezone },
      origin
    }

    return this.createSchedulerJob({
      name: SchedulerConstants.AGENDA_WORKFLOW,
      data,
      starting: new Date(runDate),
      interval: repeatEvery,
      timezone
    })
  },
  async getTaskSchedule (taskId, callback) {
    if (!taskId) {
      let err = new Error('task id required')
      return callback(err)
    }

    try {
      let jobs = await this.agenda.jobs({
        $and: [
          { name: 'task' },
          { 'data.task_id': taskId },
          { nextRunAt: { $ne: null } }
        ]
      })
      callback(null, jobs)
    } catch (err) {
      callback(err)
    }
  },
  /**
   * @param {Object} query
   * @return {Promise}
   */
  getSchedules (schedule, data) {
    let query = {}

    if (!data.customer_id) {
      throw new Error('invalid query customer')
    }

    if (!schedule.name) {
      throw new Error('invalid query name')
    }

    query.name = schedule.name // jobs in this group
    for (let prop in data) {
      query[ `data.${prop}` ] = data[prop]
    }

    return this.agenda.jobs(query)
  },
  async getSchedule (scheduleId) {
    const jobs = await this.agenda.jobs({ _id: ObjectId(scheduleId) })
    return jobs[0]
  },
  // Counts schedules for the given task
  // @param callback: Function (err, schedulesCount)
  taskSchedulesCount (task, callback) {
    this.getTaskSchedule(task._id, (err, schedules) => {
      return callback(err, err ? 0 : schedules.length)
    })
  },
  /**
   * Cancels a specific scheduleId
   *
   * @return {Promise}
   */
  cancelSchedule (scheduleId) {
    return this.agenda.cancel({ _id: new ObjectId(scheduleId) })
  },
  // deletes ALL schedules for a given task
  unscheduleTask (task) {
    return this.agenda.cancel({
      $and: [
        { name: 'task' },
        { 'data.task_id': task._id }
      ]
    })
  },
  // deletes ALL schedules for a given task
  unscheduleWorkflow (workflow) {
    return this.agenda.cancel({
      $and: [
        { name: SchedulerConstants.AGENDA_WORKFLOW },
        { 'data.workflow_id': workflow._id },
      ]
    })
  },
  /**
   * @param {Job} job
   * @return {Promise}
   */
  cancelScheduledTimeoutVerificationJob (job) {
    this.agenda.cancel({
      $and: [
        { name: 'job-timeout' },
        { 'data.job_id': job._id.toString() }
      ]
    })
  },
  /**
   * @param {Job} job
   * @return {Promise}
   */
  scheduleJobTimeoutVerification (job) {
    let defaultTimeout = (10 * 60 * 1000) // 10 minutes in milliseconds
    let timeout = (job.timeout || defaultTimeout) + (60 * 1000)
    let now = new Date()

    return this.createSchedulerJob({
      name: SchedulerConstants.AGENDA_TIMEOUT_JOB,
      data: { job_id: job._id.toString() },
      starting: new Date(now.getTime() + timeout),
      interval: null
    })
  },
  /**
   * Schedules a job for its starting date and parsing its properties
   *
   * @param {Date} starting first execution
   * @param {String} name
   * @param {Object} data
   * @param {String} interval human format or cron
   * @return {Promise}
   */
  createSchedulerJob ({ name, data, starting, interval, timezone }) {
    let agendaJob = this.agenda.create(name, data)

    if (interval) {
      logger.log("repeat interval is %s", interval)
      agendaJob.repeatEvery(interval, {
        skipImmediate: true,
        timezone
      })
    }

    if (starting) {
      if (starting instanceof Date && !isNaN(starting.getTime())) {
        logger.log("agendaJob.schedule %s", starting)
        agendaJob.schedule(starting)
      }
    }
    return agendaJob.save()
  }
}

const setupAgendaJobs = (agenda) => {
  /**
   *
   * handle scheduled task execution
   *
   */
  agenda.define(SchedulerConstants.AGENDA_TASK, job => {
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
    logger.log('||  Agenda Job Processor: Task Job')
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')

    return TaskJobProcessor(job)
  })

  /**
   *
   * handle scheduled workflow execution
   *
   */
  agenda.define(SchedulerConstants.AGENDA_WORKFLOW, job => {
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
    logger.log('||  Agenda Job Processor: Workflow Job')
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')

    return WorkflowJobProcessor(job)
  })

  /**
   *
   * job execution timeout handler.
   *
   * check lifecycle of jobs under execution
   *
   */
  agenda.define(SchedulerConstants.AGENDA_TIMEOUT_JOB, async agendaJob => {
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
    logger.log('||  Agenda Job Processor: job-timeout event')
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')

    const jobData = agendaJob.attrs.data
    await App.jobDispatcher.jobExecutionTimedOutCheck(jobData.job_id)
    await agendaJob.remove()
  })

  //agenda.on('start', (job) => { })
  //agenda.on('complete', (job) => { })
  //agenda.on('success', (job) => { })

  agenda.on('fail', (err, job) => {
    logger.log('job %s failed %j', job.attrs.name, err.stack)
    job.disable()
    job.save()
  })

  // Unlock agenda events when process finishes
  const graceful = () => {
    logger.log('SIGTERM/SIGINT agenda graceful stop')
    agenda.stop(function(){})
    //process.exit(0)
  }

  process.on('SIGTERM', graceful)
  process.on('SIGINT', graceful)
}

const TaskJobProcessor = async (agendaJob) => {
  const data = agendaJob.attrs.data
  const task = await App.Models.Task.Entity
    .findById(data.task_id)
    .populate('customer')
    .exec()

  if (!task) {
    throw new Error(`task ${data.task_id} is no longer available`)
  }

  if (!task.customer) {
    throw new Error(`customer ${data.task_id} is no longer available`)
  }

  return App.jobDispatcher.create({
    task,
    customer: task.customer,
    user: App.user,
    origin: JobConstants.ORIGIN_SCHEDULER,
    task_arguments_values: data.task_arguments_values || null,
    notify: data.notify || true,
  })
}

const WorkflowJobProcessor = async (agendaJob) => {
  const data = agendaJob.attrs.data
  const workflow = await App.Models.Workflow.Workflow
    .findById(data.workflow_id)
    .populate('customer')
    .exec()

  if (!workflow) {
    throw new Error(`workflow ${data.workflow_id} is no longer available`)
  }

  if (!workflow.customer) {
    throw new Error(`customer ${workflow.customer} is no longer available`)
  }

  await workflow.execPopulate()

  return App.jobDispatcher.createByWorkflow({
    workflow,
    customer: workflow.customer,
    user: App.user,
    origin: JobConstants.ORIGIN_SCHEDULER,
    task_arguments_values: data.task_arguments_values || null,
    notify: data.notify || true,
  })
}

/**
 * @return {Array}
 */
//const verifyTask = async (task, done) => {
//  let customer = App.Models.Customer.Entity.findById(task.customer_id)
//  let host = App.Models.Host.Entity.findById(task.host_id)
//  let script
//
//  if (task.type === 'script') {
//    script = App.Models.File.Script.findById(task.script_id)
//  }
//
//  let data = await Promise.all([ customer, host, script ])
//
//  if (!data[0]) {
//    throw new Error(`customer ${task.customer_id} is no longer available`)
//  }
//
//  if (!data[1]) {
//    throw new Error(`host ${task.host_id} is no longer available`)
//  }
//
//  if (task.type === 'script' && ! data[2]) {
//    throw new Error(`script ${task.script_id} is no longer available`)
//  }
//
//  return data
//}

module.exports = new Scheduler()
