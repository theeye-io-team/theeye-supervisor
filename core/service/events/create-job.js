const App = require('../../app')
const logger = require('../../lib/logger')(':events:create-job')

/**
 * @author Facugon
 * @param {Object} input
 * @property {Task} input.task
 * @property {Array} input.task_arguments_values array
 * @property {String} input.origin job creation origin
 * @property {User} input.user
 * @access private
 */
module.exports = (input) => {
  let { task } = input
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

    if (
      task._type !== 'ApprovalTask' &&
      task._type !== 'DummyTask' &&
      ! task.host
    ) {
      logger.error('WARNING. Task %s does not has assigned host. Cannot execute', task._id)
      return
    }

    App.jobDispatcher.create(
      Object.assign(input, {
        customer: task.customer,
        notify: true,
      }), (err, job) => {
        if (err) {
          logger.error('cannot create workflow job')
          return logger.error(err)
        }
        // job created
        logger.log('job created by workflow')
      }
    )
  })
}
