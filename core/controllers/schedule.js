const App = require('../app')
const logger = require('../lib/logger')('eye:supervisor:controller:schedule')
const Scheduler = require('../service/scheduler')
const router = require('../router')
const { ClientError } = require('../lib/error-handler')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.del('/:customer/scheduler/:schedule', middlewares, remove)
}

const remove = async (req, res, next) => {
  try {
    const scheduleId = req.params.schedule

    if (!scheduleId) {
      throw new ClientError('schedule id required')
    }

    let numRemoved = await App.scheduler.cancelSchedule(scheduleId)
    res.send(200, { numRemoved })
  } catch (err) {
    logger.error('%o', err)
    return res.send(500)
  }
}
