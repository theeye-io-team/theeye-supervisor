const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:job:queue')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  /**
   * fetch many jobs information
   */
  server.get('/job/queue',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    queueController
  )
}

const queueController = async (req, res, next) => {
  try {
    const { customer, user, host } = req

    if (!host) {
      throw new ClientError('host required')
    }

    const jobs = await App.jobDispatcher.getJobs({ customer, host, task })

    for (let job of jobs) {
      App.scheduler.scheduleJobTimeoutVerification(job)
    }

    res.send(200, jobs)
    next()
  } catch (err) {
    logger.error(err)
    res.sendError(err)
  }
}
