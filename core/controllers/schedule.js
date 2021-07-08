const App = require('../app')
const logger = require('../lib/logger')('eye:supervisor:controller:schedule')
const Scheduler = require('../service/scheduler')
const Router = require('../router')
const Audit = require('../lib/audit')
const Constants = require('../constants')
const { ServerError, ClientError } = require('../lib/error-handler')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer
  ]

  server.del(
    '/:customer/scheduler/:schedule',
    middlewares,
    async (req, res, next) => {
      try {
        const scheduleId = req.params.schedule
        if (!scheduleId) {
          throw new ClientError('schedule id required')
        }

        const schedule = await App.scheduler.getSchedule(scheduleId)
        if (!schedule) {
          throw new ClientError('schedule not found')
        }

        if (schedule.constructor.name !== 'Job') {
          throw new ServerError('schedule error')
        }

        req.schedule = schedule.attrs

        next()
      } catch (err) {
        req.send(err.statusCode, err.message)
      }
    },
    remove,
    Audit.afterRemove('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.DELETE })
  )

  //server.put(
  //  '/:customer/scheduler/:schedule/stop',
  //  middlewares
  //)

  //server.put(
  //  '/:customer/scheduler/:schedule/start',
  //  middlewares
  //)
}

const remove = async (req, res, next) => {
  try {
    const schedule = req.schedule
    const numRemoved = await App.scheduler.cancelSchedule(schedule._id)
    res.send(200, { numRemoved })
    next()
  } catch (err) {
    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}
