const cronParser = require('cron-parser')
const App = require('../../app')
const logger = require('../../lib/logger')('eye:supervisor:controller:schedule')
const Scheduler = require('../../service/scheduler')
const Router = require('../../router')
const Audit = require('../../lib/audit')
const Constants = require('../../constants')
const { ServerError, ClientError } = require('../../lib/error-handler')

module.exports = (server) => {

  const schedulerResolver = async (req, res) => {
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

    } catch (err) {
      res.send(err.statusCode, err.message)
    }
  }

  const customNotifyMiddleware = (operation) => {
    const fn = (req, res, next) => {
      Router.notify({
        name: 'schedule',
        operation,
        model: req.schedule.attrs
      })(req, res, next)
    }

    return fn
  }

  server.del('/:customer/scheduler/:schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    schedulerResolver,
    remove,
    Audit.afterRemove('schedule', { display: 'name' }),
    customNotifyMiddleware(Constants.DELETE)
  )

  server.del('/scheduler/:schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity(),
    Router.ensureCustomer,
    schedulerResolver,
    remove,
    Audit.afterRemove('schedule', { display: 'name' }),
    customNotifyMiddleware(Constants.DELETE)
  )

  server.put('/scheduler/:schedule/stop',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity(),
    Router.ensureCustomer,
    schedulerResolver,
    stop,
    Audit.afterUpdate('schedule', { display: 'name' }),
    customNotifyMiddleware(Constants.UPDATE)
  )

  server.put('/scheduler/:schedule/start',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity(),
    Router.ensureCustomer,
    schedulerResolver,
    start,
    Audit.afterUpdate('schedule', { display: 'name' }),
    customNotifyMiddleware(Constants.UPDATE)
  )
}

const remove = async (req, res) => {
  try {
    const schedule = req.schedule
    const numRemoved = await App.scheduler.cancelSchedule(schedule.attrs._id)
    res.send(200, { numRemoved })
  } catch (err) {
    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}

const start = async (req, res) => {
  try {
    const job = req.schedule

    if (req.body && req.body.runDate) {
      const nextRun = new Date(req.body.runDate)
      if (nextRun == 'Invalid Date') {
        throw new ClientError('Invalid Date')
      }
      job.schedule(nextRun)
    } else {
      try {
        const interval = cronParser.parseExpression(job.attrs.repeatInterval, {
          currentDate: new Date(),
          tz: job.attrs.repeatTimezone
        })

        const nextRun = interval.next().toDate()
        job.schedule(nextRun)
      } catch (err) {
        // not a cron interval
      }
    }

    job.enable()
    await job.save()

    res.send(200, 'ok')
  } catch (err) {
    return res.sendError(err)
  }
}

const stop = async (req, res) => {
  try {
    const schedule = req.schedule
    schedule.disable()
    await schedule.save()
    res.send(200, 'ok')
  } catch (err) {
    logger.error('%o', err)
    return res.send(500, 'Internal Server Error')
  }
}
