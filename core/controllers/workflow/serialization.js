const App = require('../../app')
const logger = require('../../lib/logger')('controller:workflow:recipe');
const router = require('../../router');
const { v4: uuidv4 } = require('uuid')

module.exports = (server) => {
  server.get(
    '/workflows/:workflow/serialize',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    serialize
  )

  server.post(
    '/workflows/import',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    create
  )
}

/**
 * @summary export workflow recipe
 */
const serialize = async (req, res, next) => {
  try {
    const workflow = req.workflow
    const serial = await serializeDAG(workflow)
    return res.send(200, serial)
  } catch (err) {
    res.sendError(err)
  }
}

const serializeDAG = async (workflow) => {
  const serial = workflow.toObject()
  serial.id = uuidv4()
  serial.tasks = []
  serial.events = []

  const graph = serial.graph

  for (let node of graph.nodes) {
    const uuid = uuidv4()

    let model
    if (node && /Event$/.test(node.value._type)) {
      model = await App.Models.Event.Event.findById(node.value.id)
      model = model.toObject()
      serial.events.push(model)
    } else if (node && /Task$/.test(node.value._type)) {
      const task = await App.Models.Task.Task.findById(node.value.id)
      const recipe = await taskRecipe(task)
      model = recipe.task
      model.id = task._id.toString() //@GOTO_UUID keep until serialization ends
      if (recipe.file) {
        model.script = recipe.file
        const data = model.script.data
        model.script.data = `data:text/plain;base64,${data}` // data uri
      }
      serial.tasks.push(model)

      if (workflow.start_task_id === model.id) {
        serial.start_task_id = uuid
      }
    }

    node.v = uuid
    node.value.id = uuid

    for (let edge of graph.edges) {
      if (edge.v === model.id) { edge.v = uuid }
      if (edge.w === model.id) { edge.w = uuid }
    }

    //@GOTO_UUID serialization ended. update after mapping edges with nodes. 
    model.id = uuid
  }

  //serial.graph = graph
  return serial
}

const taskRecipe = (task) => {
  return new Promise((resolve, reject) => {
    App.task.getRecipe(task, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

/**
 * @summary import workflow recipe
 */
const create = (req, res, next) => {
  const serialization = req.body
  res.send(200)
}
