const App = require('../../app')
const logger = require('../../lib/logger')('controller:workflow:scheduler')
const Router = require('../../router')
const JobConstants = require('../../constants/jobs')
const Constants = require('../../constants')
const SchedulerConstants = require('../../constants/scheduler')
const Audit = require('../../lib/audit')
const payloadValidationMiddleware = require('../scheduler/payload-validation-middleware')

module.exports = (server) => {

  server.get('/workflows/:workflow/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('viewer'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    Router.resolve.idToEntity({ param:'workflow', required: true }),
    Router.ensureAllowed({ entity: { name: 'workflow' } }),
    fetch
  )

  server.post('/workflows/:workflow/schedule',
    server.auth.bearerMiddleware,
    Router.requireCredential('admin'),
    Router.resolve.customerNameToEntity({ required: true }),
    Router.ensureCustomer,
    Router.resolve.idToEntity({ param:'workflow', required: true }),
    payloadValidationMiddleware,
    create,
    Audit.afterCreate('schedule', { display: 'name' }),
    Router.notify({ name: 'schedule', operation: Constants.CREATE })
  )
}

const create = async (req, res) => {
  try {
    const { workflow, user, customer, body } = req

    const { runDate, repeatEvery, timezone } = body

    const schedule = await App.scheduler.scheduleWorkflow({
      origin: JobConstants.ORIGIN_SCHEDULER,
      customer,
      user,
      workflow,
      runDate,
      repeatEvery,
      timezone
    })

    req.schedule = schedule.attrs
    res.send(200, schedule)
  } catch (err) {
    logger.error(err)
    return res.send(err.statusCode || 500, err.message)
  }
}

const fetch = async (req, res) => {
  try {
    const customer = req.customer
    const workflow = req.workflow

    let schedules = await App.scheduler.getSchedules(
      // query agenda schedules
      schedule = {
        name: SchedulerConstants.AGENDA_WORKFLOW
      },
      // query in embedded data property
      data = {
        customer_id: customer._id,
        workflow_id: workflow._id
      }
    )

    res.send(200, schedules)
  } catch (err) {
    res.send(err.statusCode || 500, err.message)
  }
}
