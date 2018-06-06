const App = require('../../app')
const logger = require('../../lib/logger')(':events:create-job')

/**
 * @author Facugon
 * @param {Object} input
 * @property {Task} input.task
 * @property {String} input.origin job creation origin
 * @property {User} input.user
 * @property {Event} input.event
 * @property {Object} input.event_data
 * @access private
 */
module.exports = ({ task, origin, user, event, event_data }) => {
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
    if (task._type != 'ApprovalTask' && !task.host) {
      logger.error('WARNING. Task %s does not has a host. Cannot execute', task._id)
      return
    }

    const customer = task.customer
    const runDate =  Date.now() + task.grace_time * 1000

    if (task.grace_time > 0) {
      // schedule the task
      let data = {
        event: event._id,
        event_data,
        task,
        user,
        customer,
        notify: true,
        schedule: { runDate },
        origin
      }
      App.scheduler.scheduleTask(data, (err, agenda) => {
        if (err) {
          logger.error('cannot schedule workflow job')
          return logger.error(err)
        }

        App.customer.getAlertEmails(customer.name,(err, emails)=>{
          App.jobDispatcher.sendJobCancelationEmail({
            task_secret: task.secret,
            task_id: task.id,
            schedule_id: agenda.attrs._id,
            task_name: task.name,
            hostname: task.host.hostname,
            date: new Date(runDate).toISOString(),
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
        origin
      }, (err, job) => {
        if (err) {
          logger.error('cannot create workflow job')
          return logger.error(err)
        }
        // job created
        logger.log('job created by workflow')
      })
    }
  })
}
