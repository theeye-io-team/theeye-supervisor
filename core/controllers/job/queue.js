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
    //router.resolve.idToEntity({ param: 'host', required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    queueController
  )
}

const queueController = async (req, res, next) => {
  try {
    const { customer, user, task } = req
    const query = req.query

    if (query.limit && isNaN(query.limit)) {
      throw new ClientError('Invalid limit value')
    }
    const limit = ( Number(query.limit) || 1)

    const jobs = await App.jobDispatcher.getJobsByTask({
      customer,
      //host,
      task,
      limit
    })

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
