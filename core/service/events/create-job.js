const App = require('../../app')
const logger = require('../../lib/logger')(':events:create-job')

/**
 * @author Facugon
 * @param {Object} input
 * @property {Task} input.task
 * @property {Array} input.task_arguments_values array
 * @property {String} input.origin job creation origin
 * @property {User} input.user
 * @property {Job} input.previous_job trigger
 * @access private
 * @return {Promise}
 */
module.exports = async (input) => {
  const { task } = input
  logger.log('preparing to run task %s', task._id)

  await task.populate([
    { path: 'customer' },
    { path: 'host' }
  ])

  if (!task.customer) {
    logger.error('FATAL. Task %s does not has a customer', task._id)
    return
  }

  if (
    task._type !== 'ApprovalTask' &&
    task._type !== 'DummyTask' &&
    task._type !== 'NotificationTask' &&
    ! task.host
  ) {
    logger.error('Task %s does not has a host assigned. Cannot execute', task._id)
    return
  }

  const data = Object.assign({}, input, {
    customer: task.customer,
    notify: true,
  })

  const job = await App.jobDispatcher.create(data)
  logger.log('job created by workflow')
}
