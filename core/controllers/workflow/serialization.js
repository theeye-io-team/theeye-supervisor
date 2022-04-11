const App = require('../../app')
const logger = require('../../lib/logger')('controller:workflow:recipe');
const router = require('../../router');
const TaskConstants = require('../../constants/task')
const { v4: uuidv4 } = require('uuid')
const graphlib = require('graphlib')

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
  delete serial.id
  serial.tasks = []
  //serial.events = []

  let graph
  if (!workflow.version || workflow.version < 2) {
    graph = migrateGraph(serial.graph)
    serial.version = 2
  } else {
    graph = graphlib.json.write(graphlib.json.read(serial.graph))
  }

  for (let node of graph.nodes) {
    const uuid = uuidv4()

    let model
    if (node && /Event$/.test(node.value._type)) {
      model = await App.Models.Event.Event.findById(node.value.id)
      model = model.toObject()
      serial.events.push(model)
    } else if (node && /Task$/.test(node.value._type)) {
      const task = await App.Models.Task.Task.findById(node.value.id)

      model = await taskRecipe(task)
      model.id = task._id.toString() //@GOTO_UUID keep until serialization ends
      if (model.type === TaskConstants.TYPE_SCRIPT) {
        model.script_id = null
        model.source_model_id = null
      }
      serial.tasks.push(model)

      if (workflow.start_task_id.toString() === model.id) {
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

  serial.graph = graph
  return serial
}

const taskRecipe = (task) => {
  return new Promise((resolve, reject) => {
    App.task.getRecipe(task, {}, (err, data) => {
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

const migrateGraph = (graph) => {
  const cgraph = graphlib.json.read(graph)
  const ngraph = new graphlib.Graph()

  const eventNodes = []
  const nodes = cgraph.nodes()
  for (let id of nodes) {
    const value = cgraph.node(id)

    if (/Event$/.test(value._type) === false) {
      ngraph.setNode(id, value)
    } else {
      eventNodes.push({ id, value })
    }
  }

  for (let node of eventNodes) {
    const eventName = node.value.name
    const edges = cgraph.nodeEdges(node.id)

    const connect = []
    for (let edge of edges) {
      if (edge.w === node.id) {
        connect[0] = edge.v
      } else {
        connect[1] = edge.w
      }
    }
    ngraph.setEdge(connect[0], connect[1], eventName)
  }

  return graphlib.json.write(ngraph)
}

