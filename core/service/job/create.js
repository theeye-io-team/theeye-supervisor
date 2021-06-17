const App = require('../../app')
const logger = require('../../lib/logger')('service:job:create')
const LifecycleConstants = require('../../constants/lifecycle')
const jobPayloadValidationMiddleware = require('./payload-validation')

/**
 *
 * Create middleware
 *
 * @param {Object[]} req.body.task_arguments an array of objects with { order, label, value } arguments definition
 * @param {Object[]} req.body.lifecycle
 *
 */
module.exports = async (req, res, next) => {
  try {
    const payload = await jobPayloadValidationMiddleware(req)
    const { user } = req

    logger.log('creating new job')

    const job = await App.jobDispatcher.create(payload)

    let data
    if (job.agenda && job.agenda.constructor.name === 'Agenda') {
      data = job.attrs
    } else {
      data = job.publish()
    }

    data.user = {}
    if (user.email || user.id) {
      Object.assign(data.user, {
        id: user.id,
        username: user.username,
        email: user.email
      })
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
