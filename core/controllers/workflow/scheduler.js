const App = require('../../app')
const logger = require('../../lib/logger')('controller:workflow:scheduler')
const router = require('../../router')
const resolver = router.resolve
const JobConstants = require('../../constants/jobs')
const SchedulerConstants = require('../../constants/scheduler')
const { ClientError } = require('../../lib/error-handler')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    resolver.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    resolver.idToEntity({ param:'workflow', required: true })
  ]

  server.get('/workflows/:workflow/schedule', middlewares, fetch)

  server.post('/workflows/:workflow/schedule', middlewares, create)
}

const create = async (req, res, next) => {
  try {
    const user = req.user
    const customer = req.customer
    const workflow = req.workflow

    const { runDate, repeatEvery } = req.body

    if (!runDate) {
      throw new ClientError('Must have a run date')
    }

    const schedule = await App.scheduler.scheduleWorkflow({
      origin: JobConstants.ORIGIN_SCHEDULER,
      customer,
      user,
      workflow,
      runDate,
      repeatEvery
    })

    res.send(200, schedule)
  } catch (err) {
    logger.error(err)
    return res.send(err.statusCode || 500, err.message)
  }
}

const fetch = async (req, res, next) => {
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
    next()
  } catch (err) {
    res.send(err.statusCode || 500, err.message)
  }
}
