const App = require('../app')
const logger = require('../lib/logger')('eye:supervisor:controller:schedule')
const Scheduler = require('../service/scheduler')
const Router = require('../router')
const Audit = require('../lib/audit')
const Constants = require('../constants')
const { ServerError, ClientError } = require('../lib/error-handler')

module.exports = (server) => {

  const schedulerResolver = async (req, res, next) => {
    try {
      const id = req.params.schedule
      if (!id) {
        throw new ClientError('schedule id required')
      }

      const schedule = await App.scheduler.getSchedule(id)
      if (!schedule) {
        throw new ClientError('schedule not found')
      }

      if (schedule.constructor.name !== 'Job') {
        throw new ServerError('schedule error')
      }

      req.schedule = schedule

      next()
    } catch (err) {
      res.send(err.statusCode, err.message)
    }
  }

  server.del('/:customer/scheduler/:schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    schedulerResolver,
    remove,
    Audit.afterRemove('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.DELETE })
  )

  server.del('/scheduler/:schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity({ required: true }),
    Router.ensureCustomer,
    schedulerResolver,
    remove,
    Audit.afterRemove('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.DELETE })
  )

  server.put('/scheduler/:schedule/stop',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity({ required: true }),
    Router.ensureCustomer,
    schedulerResolver,
    stop,
    Audit.afterUpdate('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.UPDATE })
  )

  server.put('/scheduler/:schedule/start',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity({ required: true }),
    Router.ensureCustomer,
    schedulerResolver,
    start,
    Audit.afterUpdate('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.UPDATE })
  )
}

const remove = async (req, res, next) => {
  try {
    const schedule = req.schedule
    const numRemoved = await App.scheduler.cancelSchedule(schedule.attrs._id)
    res.send(200, { numRemoved })
    next()
  } catch (err) {
    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}

const start = async (req, res, next) => {
  try {
    const job = req.schedule

    if (req.body && req.body.schedule) {
      const nextRun = new Date(req.body.schedule)
      if (nextRun == 'Invalid Date') {
        throw new ClientError('Invalid Date')
      }
      job.schedule(nextRun)
    }

    job.enable()
    await job.save()

    res.send(200, 'ok')
    next()
  } catch (err) {
    return res.sendError(err)
  }
}

const stop = async (req, res, next) => {
  try {
    const schedule = req.schedule
    schedule.disable()
    await schedule.save()
    res.send(200, 'ok')
    next()
  } catch (err) {
    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}
