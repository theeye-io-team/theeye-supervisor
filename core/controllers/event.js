
const App = require('../app')
const router = require('../router')
const { ServerError, ClientError } = require('../lib/error-handler')

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
  'collection': App.Models.Monitor.Monitor,
  'model': App.Models.Event.MonitorEvent
//}, {
//  'name': 'workflow',
//  'collection': App.Models.Workflow.Workflow,
//  'model': App.Models.Event.WorkflowEvent
}]

module.exports = (server) => {

  const validateRequiredParamsMiddleware = async (req, res) => {
    const body = req.body
    const customer = req.customer

    if (!body.type) {
      throw new ClientError('emitter type is required')
    }
    if (!body.event_name) {
      throw new ClientError('event name is required')
    }
    if (!body.emitter_id) {
      throw new ClientError('emitter id is required')
    }

    const typeModel = Types.find(t => t.name === body.type)
    if (!typeModel) {
      throw new ClientError(`Type ${type} is not implemented`)
    }
  }

  server.post('/event',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    validateRequiredParamsMiddleware,
    controller.create
  )

  server.post('/event/ensure',
    server.auth.bearerMiddleware,
    router.requireCredential('admin'),
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    validateRequiredParamsMiddleware,
    controller.ensureExists
  )

  server.get('/:customer/event/:event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'event', required: true }),
    controller.get
  )

  server.get('/:customer/event',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  server.get('/event',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
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

const controller = {
  async ensureExists (req, res) {
    try {
      const { type } = req.body
      const typeModel = Types.find(t => t.name === type)
      const eventData = prepareEventData(req)
      let event = await typeModel.model.findOne({
        name: eventData.name,
        emitter: eventData.emitter_id,
        customer: eventData.customer,
      })
      if (!event) {
        event = await typeModel.model.create(eventData)
      }

      await event.populate({
        path: 'emitter',
        select: '_id name title _type type host host_id workflow_id',
        populate: {
          path: 'host',
          select: 'hostname _id'
        }
      }).execPopulate()
      req.event = event
      res.send(200, event)
    } catch (err) {
      res.sendError(err)
    }
  },
  async create (req, res) {
    try {
      const { type } = req.body
      const typeModel = Types.find(t => t.name === type)
      const eventData = prepareEventData(req)
      let event = await typeModel.model.findOne({
        name: eventData.name,
        emitter: eventData.emitter_id,
        customer: eventData.customer,
      })
      if (event) {
        throw new ClientError('Event exists', {statusCode: 409})
      }

      event = await typeModel.model.create(eventData)
      await event.populate({
        path: 'emitter',
        select: '_id name title _type type host host_id workflow_id',
        populate: {
          path: 'host',
          select: 'hostname _id'
        }
      }).execPopulate()
      req.event = event
      res.send(200, event)
    } catch (err) {
      res.sendError(err)
    }
  },
  async get (req, res) {
    req.send(200, req.event)
  },
  async fetch (req, res) {
    const filters = req.dbQuery
    filters.where.emitter = { $ne: null }
    filters.include = '_id emitter name _type emitter_id'
    filters.populate = {
      path: 'emitter',
      select: '_id name title _type type host host_id workflow_id',
      populate: {
        path: 'host',
        select: 'hostname _id'
      }
    }

    const events = await App.Models.Event.Event.fetchBy(filters)
    res.send(200, events)
  },
  async fetchEmitters (req, res) {
    try {
      const filter = req.dbQuery

      // to fetch Monitors
      filter.where.$or.push({ customer_name: req.customer.name })

      const qtype = req.query.type

      filter.include = {
        _id: 1,
        name: 1,
        title: 1,
        _type: 1,
        type: 1,
        tags: 1
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
  async getEmitterEvents (req, res) {
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


const prepareEventData = ({ body, customer }) => {
  const eventData = {
    name: body.event_name,
    emitter: body.emitter_id,
    emitter_id: body.emitter_id,
    customer: customer.id,
    customer_id: customer.id,
  }

  return eventData
}
