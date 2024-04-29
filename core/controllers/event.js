
const App = require('../app')
const router = require('../router')
const { ServerError, ClientError } = require('../lib/error-handler')

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

  server.post('/event',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    controller.create
  )

  server.get('/event/emitters', 
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetchEmitters
  )

  server.get('/event/type/:type/emitter/:emitter/events',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.getEmitterEvents
  )
}

const Types = [{
  'name':'indicator',
  'collection': App.Models.Indicator.Indicator,
  'model': App.Models.Event.IndicatorEvent
}, {
  'name': 'task',
  'collection': App.Models.Task.Task,
  'model': App.Models.Event.TaskEvent
}, {
  'name': 'webhook',
  'collection': App.Models.Webhook.Webhook,
  'model': App.Models.Event.WebhookEvent
}, {
  'name': 'monitor',
  'collection': App.Models.Resource.Resource,
  'model': App.Models.Event.MonitorEvent
}, {
  'name': 'workflow',
  'collection': App.Models.Workflow.Workflow,
  'model': App.Models.Event.WorkflowEvent
}]

const controller = {
  async create (req, res, next) {
    try {
      const body = req.body
      const customer = req.customer

      if (!body.type) {
        throw new ClientError('emitter type is required')
      }

      const typeModel = Types.find(t => t.name === body.type)
      if (!typeModel) {
        throw new ClientError(`Type ${type} is not implemented`)
      }

      const eventData = {
        name: body.name,
        emitter: body.emitter_id,
        emitter_id: body.emitter_id,
        customer: customer.id,
        customer_id: customer.id,
      }

      const emitter = await typeModel.model.create(eventData)
      res.send(200, emitter)

    } catch (err) {
      res.sendError(err)
    }
  },
  get (req, res, next) {
    req.send(200, req.event)
  },
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
  async fetchEmitters (req, res, next) {
    try {
      const filter = req.dbQuery
      const qtype = req.query.type

      filter.include = {
        _id: 1,
        name: 1,
        title: 1,
        _type: 1,
        type: 1
      }

      let payload = {}

      let typeModel
      if (qtype) {
        typeModel = Types.find(t => t.name === qtype)
        if (!typeModel) {
          throw new ClientError(`Type ${qtype} is not implemented`)
        }

        payload[typeModel.name] = await typeModel.collection
          .fetchBy(filter)
      } else {
        for (let index in Types) {
          const type = Types[index]
          payload[type.name] = await type.collection.fetchBy(filter)
        }
      }

        res.send(200, payload)
    } catch (err) {
      res.sendError(err)
    }
  },
  async getEmitterEvents (req, res, next) {
    try {
      const customer = req.customer
      const filter = req.dbQuery
      const { type, emitter } = req.params

      const typeModel = Types.find(t => t.name === type)
      if (!typeModel) {
        throw new ClientError(`Type ${type} is not implemented`)
      }

      filter.where = {
        customer: customer.id,
        emitter: emitter
      }

      const events = await typeModel.model.fetchBy(filter)

      res.send(200, events)
    } catch (err) {
      res.sendError(err)
    }
  }
}
