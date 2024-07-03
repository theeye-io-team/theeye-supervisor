const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:scheduler')
const Router = require('../../router')
const JobConstants = require('../../constants/jobs')
const Constants = require('../../constants')
const Audit = require('../../lib/audit')
const payloadValidationMiddleware = require('../scheduler/payload-validation-middleware')

module.exports = function (server) {

  /** 
  * @openapi
  * /{customer}/task/{task}/schedule:
  *   get:
  *     summary: Get task schedule
  *     description: Get task schedule from specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved task information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/task/:task/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('viewer'),
    Router.resolve.customerSessionToEntity(),
    Router.ensureCustomer,
    Router.ensurePermissions(),
    Router.resolve.idToEntity({ param:'task', required: true }),
    Router.ensureAllowed({ entity: { name: 'task' } }),
    fetch
  )

  /** 
  * @openapi
  * /{customer}/task/{task}/schedule:
  *   post:
  *     summary: Create task schedule
  *     description: Create task schedule for a specific task.
  *     tags:
  *       - Task
  *     parameters:
  *       - name: customer
  *         in: query
  *         description: Customer id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Task
  *         in: query
  *         description: Task id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully deleted jobs.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Task'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.post('/:customer/task/:task/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerSessionToEntity(),
    Router.ensureCustomer,
    Router.ensurePermissions(),
    Router.resolve.idToEntity({ param:'task', required: true }),
    // @TODO-DEPRECATED_REMOVE Middleware
    // backward compatibility middleware
    // remove 2021-01-01
    (req, res, next) => {
      if (req.body && req.body.scheduleData) {
        let data = req.body.scheduleData
        req.body.runDate = data?.runDate
        req.body.repeatEvery = data?.repeatEvery
      }
      next()
    },
    payloadValidationMiddleware,
    create,
    Audit.afterCreate('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.CREATE })
  )
}

/**
 * Gets schedule data for a task
 * @method GET
 * @route /:customer/task/:task/schedule
 * @param {String} :task , mongo ObjectId
 *
 */
const fetch = (req, res, next) => {
  const task = req.task
  App.scheduler.getTaskSchedule(task._id, (err, schedule) => {
    if (err) {
      res.sendError(err)
    } else {
      res.send(200, schedule)
      next()
    }
  })
}

/**
 * @method POST
 * @route /:customer/task/:task/schedule
 */
const create = async (req, res) => {
  try {
    const { task, user, customer, body } = req

    const { runDate, repeatEvery, timezone } = body

    const schedule = await new Promise((resolve, reject) => {
      App.scheduler.scheduleTask({
        origin: JobConstants.ORIGIN_SCHEDULER,
        task,
        customer,
        user,
        runDate,
        repeatEvery,
        timezone
      }, (err, schedule) => {
        if (err) { reject(err) }
        else { resolve(schedule) }
      })
    })

    req.schedule = schedule.attrs
    res.send(200, schedule)
  } catch (err) {
    res.sendError(err)
  }
}
