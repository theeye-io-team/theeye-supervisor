const App = require('../../app')
const logger = require('../../lib/logger')('service:job:create')
const LifecycleConstants = require('../../constants/lifecycle')
const jobPayloadValidationMiddleware = require('./payload-validation')
const qs = require('qs')

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

    req.job = job
    if (waitResult(req)) {
      const query = Object.assign({}, req.query)
      query.counter = 0
      query.limit = (req.query.limit || 10)
      query.timeout = (req.query.timeout || 5)
      const encodedquerystring = qs.stringify(query)

      res.header('Location', `/job/${job.id}/result?${encodedquerystring}`)
      res.send(303, data)
    } else {
      res.send(200, data)
      next()
    }
  } catch (err) {
    res.sendError(err)
  }
}

const waitResult = (req) => {
  return req.query.wait_result === 'true' || req.body.wait_result === true
}
