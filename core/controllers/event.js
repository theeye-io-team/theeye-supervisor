
const App = require('../app')
const router = require('../router')

module.exports = (server) => {
  server.get('/:customer/event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    controller.fetch
  )

  server.get('/:customer/event/:event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'event', required: true }),
    controller.get
  )

  server.get('/event/triggers', 
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetchTriggers
  )

  server.get('/event/emitter/:emitter/events',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    controller.fetchEmitterEvents
  )
}

const controller = {
  fetch (req, res, next) {
    App.Models.Event.Event.fetch({
      customer: req.customer._id,
      emitter: { $ne: null }
    }, (err,events) => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200, events)
      }
    })
  },
  get (req, res, next) {
    req.send(200, req.event)
  },
  async fetchTriggers (req, res, next) {
    try {
      const filter = req.dbQuery

      filter.include = {
        _id: 1,
        name: 1,
        title: 1,
        _type: 1,
        type: 1
      }

      const indicators = await App.Models.Indicator.Indicator
        .fetchBy(filter)

      const tasks = await App.Models.Task.Task
        .fetchBy(filter)

      const monitors = await App.Models.Resource.Resource
        .fetchBy(filter)

      const workflows = await App.Models.Workflow.Workflow
        .fetchBy(filter)

      res.send(200, { indicators, tasks, monitors, workflows})
    } catch (err) {
      res.sendError(err)
    }
  },

  async fetchEmitterEvents (req, res, next) {
  }

}
