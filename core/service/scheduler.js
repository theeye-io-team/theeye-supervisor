
const Agenda = require('agenda')
const ObjectId = require('mongoose').Types.ObjectId
const EventEmitter = require('events').EventEmitter
const util = require('util')

const App = require('../app')

const logger = require('../lib/logger')(':scheduler')
const mongodb = require('../lib/mongodb').connection.db
const Host = require('../entity/host').Entity
const Task = require('../entity/task').Entity
const Script = require('../entity/file').Script
const Customer = require('../entity/customer').Entity

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
      const schedule = input.schedule

      const data = {
        task_id: task._id,
        name: task.name,
        user_id: App.user.id,
        customer_id: customer.id,
        customer_name: customer.name,
        lifecycle: LifecycleConstants.READY,
        notify: input.notify || false,
        scheduleData: schedule,
        origin: input.origin
      }

      // runDate is miliseconds
      let date = new Date(schedule.runDate)
      let frequency = schedule.repeatEvery || false
      let job = await this.schedule(date, 'task', data, frequency)
      return done(null, job)
    } catch (err) {
      return done(err)
    }
  },
  /**
   * Schedules a job for its starting date and parsing its properties
   *
   * @return {Promise}
   */
  schedule (starting, jobName, data, interval) {
    let agendaJob = this.agenda.create(jobName, data)
    logger.log("agendaJob.schedule %s", starting)

    if (interval) {
      logger.log("repeatEvery %s", interval)
      agendaJob.repeatEvery(interval)
    }

    agendaJob.schedule(starting)
    return agendaJob.save()
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
  async getSchedules (customerId, callback) {
    if (!customerId) {
      let err = new Error('customer id must be provided')
      return callback(err)
    }

    try {
      let jobs = await this.agenda.jobs({
        $and: [
          { name: 'task' },
          { 'data.customer_id': customerId }
        ]
      })

      callback(null, jobs)
    } catch (err) {
      callback(err)
    }
  },
  // Counts schedules for the given task
  // @param callback: Function (err, schedulesCount)
  taskSchedulesCount (task, callback) {
    this.getTaskSchedule(task._id, (err, schedules) => {
      return callback(err, err ? 0 : schedules.length)
    })
  },
  //Cancels a specific scheduleId. Task is provided for further processing
  async cancelTaskSchedule (task, scheduleId, callback) {
    if (!scheduleId) {
      let err = new Error('schedule id must be provided')
      return callback(err)
    }

    try {
      let numRemoved = await this.agenda.cancel({
        $and: [
          { name: 'task' },
          { _id: new ObjectId(scheduleId) }
        ]
      })
      callback(null, numRemoved)
    } catch (err) {
      callback(err)
    }
  },
  // deletes ALL schedules for a given task
  unscheduleTask (task) {
    return this.agenda.cancel({
      $and: [
        { name: 'task' },
        { 'data.task_id': task._id }
      ]
    })
  }
}

const setupAgendaJobs = (agenda) => {
  /**
   *
   * task execution handler. cron.
   *
   * handle scheduled task creation
   *
   */
  agenda.define('task', async job => {
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
    logger.log('||  Agenda Job Processor: task event         ||')
    logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')

    return await taskProcessor(job)
  })

  /**
   *
   * job execution timeout handler.
   *
   * check lifecycle of jobs under execution
   *
   */
  agenda.define('job-timeout', async function (agendaJob, done) {
    try {
      logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
      logger.log('||  Agenda Job Processor: job-timeout event  ||')
      logger.log('|||||||||||||||||||||||||||||||||||||||||||||||')
      let jobData = agendaJob.attrs.data
      await App.jobDispatcher.jobExecutionTimedOut(jobData.job_id)
      await agendaJob.remove()
    } catch (err) {
      agendaJob.fail(err)
      await agendaJob.save()
    }
    done()
  })

  agenda.on('start', (job) => {
    logger.log('job %s started', job.attrs.name)
  })

  agenda.on('complete', (job) => {
    logger.log('job %s completed', job.attrs.name)
    //TODO nice place to check for schedules and ensure tag
  })

  agenda.on('error', (err, job) => {
    logger.log('job %s error %j', job.name, err.stack)
  })

  agenda.on('fail', (err, job) => {
    logger.log('job %s failed %j', job.name, err.stack)
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

const taskProcessor = async (agendaJob) => {
  try {
    const { task_id } = agendaJob.attrs.data
    const task = await Task.findById(task_id)

    if (!task) {
      throw new Error('task %s is no longer available', task_id)
    }

    const [ customer ] = await verifyTask(task)

    let payload = {
      task,
      customer,
      user: App.user,
      notify: true,
      origin: JobConstants.ORIGIN_SCHEDULER
    }

    return await App.jobDispatcher.create(payload)
  } catch (err) {
    logger.error(err)
    agendaJob.fail(err)
    return await agendaJob.save()
  }
}

/**
 * @return {Array}
 */
const verifyTask = async (task, done) => {
  let customer = Customer.findById(task.customer_id)
  let host = Host.findById(task.host_id)
  let script
  if (task.type === 'script') {
    script = Script.findById(task.script_id)
  }

  let data = await Promise.all([ customer, host, script ])

  if (!data[0]) {
    throw new Error(`customer ${task.customer_id} is no longer available`)
  }

  if (!data[1]) {
    throw new Error(`host ${task.host_id} is no longer available`)
  }

  if (task.type === 'script' && ! data[2]) {
    throw new Error(`script ${task.script_id} is no longer available`)
  }

  return data
}

module.exports = new Scheduler()
