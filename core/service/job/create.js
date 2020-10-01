const App = require('../../app')
const logger = require('../../lib/logger')('service:job:create')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const jobArgumentsValidateMiddleware = require('./arguments-validation')

/**
 *
 * Create middleware
 *
 * @param {Object[]} req.body.task_arguments an array of objects with { order, label, value } arguments definition
 *
 */
module.exports = async (req, res, next) => {
  try {
    const args = jobArgumentsValidateMiddleware(req)
    const { task, user, customer } = req

    logger.log('creating new job')

    const inputs = {
      task,
      user,
      customer,
      notify: true,
      origin: (req.origin || JobConstants.ORIGIN_USER),
      task_arguments_values: args 
    }

    const lifecycle = (req.body && req.body.lifecycle)
    // allow to control only following lifecycles
    if (
      lifecycle &&
      (
        lifecycle === LifecycleConstants.ONHOLD ||
        lifecycle === LifecycleConstants.SYNCING ||
        lifecycle === LifecycleConstants.LOCKED
      )
    ) {
      inputs.lifecycle = lifecycle
    }

    const job = await App.jobDispatcher.create(inputs)

    let data
    if (job.agenda && job.agenda.constructor.name === 'Agenda') {
      data = job.attrs
    } else {
      data = job.publish()
    }

    data.user = {
      id: user.id,
      username: user.username,
      email: user.email
    }

    res.send(200, data)
    req.job = job
    next()
  } catch (err) {
    if (err.name === 'ClientError') {
      return res.send(err.status, err.message)
    }

    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}
