const App = require('../../app')
const logger = require('../../lib/logger')('controller:task:scheduler')
const Router = require('../../router')
const JobConstants = require('../../constants/jobs')
const Constants = require('../../constants')
const Audit = require('../../lib/audit')

module.exports = function (server) {
  server.post('/:customer/task/:task/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    Router.resolve.idToEntity({ param:'task', required: true }),
    // @TODO-DEPRECATED_REMOVE Middleware
    // backward compatibility middleware
    // remove 2021-01-01
    (req, res, next) => {
      if (req.body && req.body.scheduleData) {
        let data = req.body.scheduleData
        req.body.runDate = data.runDate
        req.body.repeatEvery = data.repeatEvery
      }
      next()
    },
    controller.create,
    Audit.afterCreate('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.CREATE })
  )

  server.get('/:customer/task/:task/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('viewer'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    Router.resolve.idToEntity({ param:'task', required: true }),
    Router.ensureAllowed({ entity: { name: 'task' } }),
    controller.fetch
  )

  ///**
  // * this is for the email cancelation
  // * authenticate with a secret token
  // * only valid for this action
  // */
  //server.get('/:customer/task/:task/schedule/:schedule/secret/:secret',[
  //  Router.resolve.idToEntity({param:'task',required:true}),
  //  Router.requireSecret('task'),
  //  Router.resolve.customerNameToEntity({required:true}),
  //], controller.remove)
}

const controller = {
  /**
   * Gets schedule data for a task
   * @method GET
   * @route /:customer/task/:task/schedule
   * @param {String} :task , mongo ObjectId
   *
   */
  fetch (req, res, next) {
    const task = req.task
    App.scheduler.getTaskSchedule(task._id, (err, schedule) => {
      if (err) {
        logger.error('Scheduler had an error retrieving data for %s',task._id)
        logger.error(err)
        return res.send(500)
      }

      res.send(200, schedule)
      next()
    })
  },
  /**
   * @method POST
   * @route /:customer/task/:task/schedule
   */
  create (req, res, next) {
    const task = req.task
    const user = req.user
    const customer = req.customer

    const { runDate, repeatEvery, timezone } = req.body

    //if (!runDate) {
    //  return res.send(400, 'runDate required')
    //}

    App.scheduler.scheduleTask({
      origin: JobConstants.ORIGIN_SCHEDULER,
      task,
      customer,
      user,
      runDate,
      repeatEvery,
      timezone
    }, (err, schedule) => {
      if (err) {
        logger.error(err)
        return res.send(500, err)
      }
      req.schedule = schedule.attrs
      res.send(200, schedule)
      next()
    })
  }
}
