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

  /** 
  * @openapi
  * /{customer}/scheduler/{schedule}:
  *   delete:
  *     summary: Delete scheduele 
  *     tags:
  *       - Schedule
  *     description: Delete schedule from specific customer.
  *     parameters:
  *       - name: customer
  *         in: query
  *         description: Customer name
  *         required: true
  *         schema:
  *           type: string
  *       - name: schedule
  *         in: query
  *         description: Schedule id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       204:
  *         description: Successfully deleted the schedule.
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Schedule'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
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

  /** 
  * @openapi
  * /scheduler/{schedule}:
  *   delete:
  *     summary: Delete scheduele 
  *     tags:
  *       - Schedule
  *     description: Delete schedule by it's Id.
  *     parameters:
  *       - name: schedule
  *         in: query
  *         description: schedule id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       204:
  *         description: Successfully deleted the schedule.
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Schedule'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
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

  /** 
  * @openapi
  * /scheduler/{schedule}/stop:
  *   put:
  *     summary: Stop schedule 
  *     description: Stop schedule by it's Id
  *     tags:
  *       - Schedule
  *     parameters:
  *       - name: schedule
  *         in: query
  *         description: Schedule Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '201':
  *         description: Successfully updated the schedule.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Schedule'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
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

  /** 
  * @openapi
  * /scheduler/{schedule}/start:
  *   put:
  *     summary: Start schedule 
  *     description: Start schedule by it's Id
  *     tags:
  *       - Schedule
  *     parameters:
  *       - name: schedule
  *         in: query
  *         description: Schedule Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '201':
  *         description: Successfully updated the schedule.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Schedule'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
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
    res.sendError(err)
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
    res.sendError(err)
  }
}

const stop = async (req, res) => {
  try {
    const schedule = req.schedule
    schedule.disable()
    await schedule.save()
    res.send(200, 'ok')
  } catch (err) {
    res.sendError(err)
  }
}
