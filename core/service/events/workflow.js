const logger = require('../../lib/logger')(':events:workflow')
const App = require('../../app')
const Task = require('../../entity/task').Entity
const CustomerService = require('../customer')
const JobConstants = require('../../constants/jobs')

const WORKFLOW_EVENT = 'workflow-event'

module.exports = function (payload) {
  if (payload.eventName === WORKFLOW_EVENT) {
    executeWorkflowTasks(payload)
  }
}

/**
 * @param {Event} event entity to process
 * @param {Object} event_data event extra data generated
 */
const executeWorkflowTasks = ({ event, data }) => {
  Task.find({ triggers: event._id }, (err, tasks) => {
    if (err) {
      logger.error(err)
    }

    if (tasks.length == 0) return

    for (var i=0; i<tasks.length; i++) {
      createJob({
        user: App.user,
        task: tasks[i],
        event: event,
        event_data: data
      })
    }
  })
}

/**
 * @author Facugon
 * @param {Object} input
 * @property {Task} input.task
 * @property {User} input.user
 * @property {Event} input.event
 * @access private
 */
const createJob = ({ task, user, event, event_data }) => {
  logger.log('preparing to run task %s', task._id)

  task.populate([
    { path: 'customer' },
    { path: 'host' }
  ], err => {
    if (err) {
      logger.error(err)
      return
    }
    if (!task.customer) {
      logger.error('FATAL. Task %s does not has a customer', task._id)
      return
    }
    if (!task.host) {
      logger.error('WARNING. Task %s does not has a host. Cannot execute', task._id)
      return
    }

    const customer = task.customer
    const runDateMilliseconds =  Date.now() + task.grace_time * 1000

    if (task.grace_time > 0) {
      // schedule the task
      App.scheduler.scheduleTask({
        event,
        event_data,
        task,
        user,
        customer,
        notify: true,
        schedule: {
          runDate: runDateMilliseconds
        },
        origin: JobConstants.ORIGIN_WORKFLOW
      }, (err, agenda) => {
        if (err) return logger.error(err)

        CustomerService.getAlertEmails(customer.name,(err, emails)=>{
          App.jobDispatcher.sendJobCancelationEmail({
            task_secret: task.secret,
            task_id: task.id,
            schedule_id: agenda.attrs._id,
            task_name: task.name,
            hostname: task.host.hostname,
            date: new Date(runDateMilliseconds).toISOString(),
            grace_time_mins: task.grace_time / 60,
            customer_name: customer.name,
            to: emails.join(',')
          })
        })
      })
    } else {
      App.jobDispatcher.create({
        event,
        event_data,
        task,
        user,
        customer,
        notify: true,
        origin: JobConstants.ORIGIN_WORKFLOW
      }, (err, job) => {
        if (err) return logger.error(err);
        // job created
        logger.log('job created by workflow')
      })
    }
  })
}
