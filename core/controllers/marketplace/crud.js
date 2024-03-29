
/**
 *
 * Tasks:
 *
 * name
 * id
 * short_description
 * type
 * creator
 * rating
 * tags
 * icon_color
 * icon_image
 *
 * description
 *
 */
const App = require('../../app')
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')
const logger = require('../../lib/logger')('controller:job')
const AsyncController = require('../../lib/async-controller')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  server.get('/marketplace/:model',
    server.auth.bearerMiddleware,
    AsyncController(fetch)
  )

  server.get('/marketplace/:model/:id',
    server.auth.bearerMiddleware,
    AsyncController(get)
  )

  server.get('/marketplace/:model/:id/serialize',
    server.auth.bearerMiddleware,
    AsyncController(serialize)
  )

  server.post('/marketplace/:model/:id/rate',
    server.auth.bearerMiddleware,
    AsyncController(rate)
  )
}

const get = async (req) => {
  const modelName = req.params.model
  const id = req.params.id

  if (App.config.marketplace.enabled !== true) {
    return null
  }

  const Model = getMarketplaceModel(modelName)
  const model = await Model.Entity.find({
    _id: id,
    customer_id: App.config.marketplace.customer_id
  })

  return model
}

const serialize = async (req) => {
  const modelName = req.params.model
  const id = req.params.id

  if (App.config.marketplace.enabled !== true) {
    return null
  }

  const Model = getMarketplaceModel(modelName)
  const model = await Model.Entity.findOne({
    _id: id,
    customer_id: App.config.marketplace.customer_id
  })

  return Serialize[modelName](model)
}

const fetch = async (req) => {
  const modelName = req.params.model

  if (App.config.marketplace.enabled !== true) {
    return []
  }

  if (modelName === 'task') {
    return fetchTasks(req).then(tasks => tasks.map(transform))
  }

  const Model = getMarketplaceModel(modelName)
  const models = await Model.Entity.find({
    customer_id: App.config.marketplace.customer_id
  })

  return models.map(transform)
}

const fetchTasks = (req) => {
  return App.Models.Task.Entity.find({
    customer_id: App.config.marketplace.customer_id,
    $or: [
      {workflow_id: { $eq: null }},
      {workflow_id: { $exists: false }},
    ]
  })
}

const rate = async (req) => {
}

const getMarketplaceModel = (model) => {
  if (typeof model !== 'string' || !model) {
    throw new ClientError(`${model} is not a valid Marketplace model`)
  }

  const modelName = (model[0].toUpperCase() + model.toLowerCase().slice(1))
  const Model = App.Models[modelName]

  if (!Model) {
    throw new ClientError(`${model} is not a valid Marketplace model`)
  }

  if (!Model.Entity) {
    throw new ServerError(`Sorry, ${model} is not available`, { statusCode: 501 })
  }
  return Model
}

const Serialize = {}
Serialize.task = (task) => {
  return App.task.serializePromise(task)
}
Serialize.workflow = (workflow) => {
  return App.workflow.serialize(workflow)
}
Serialize.file = (file) => {
  return App.file.serializePromise(file)
}
Serialize.monitor = Serialize.indicator = (model) => {
  throw new Error('falta hacer')
}

const transform = (serial) => {
  const type = (serial.type || serial._type).toLowerCase()
  return Object.assign({}, {
    name: serial.name,
    id: serial._id?.toString(),
    type,
    creator: serial.user_id?.toString(),
    rating: serial.rating,
    tags: serial.tags,
    icon_color: serial.icon_color,
    icon_image: serial.icon_image,
    short_description: serial.short_description,
    description: serial.description,
  })
}
