
const ObjectId = require('mongoose').Types.ObjectId
const isMongoId = require('validator/lib/isMongoId')
const graphlib = require('graphlib')
const App = require('../../app')
const TopicsConstants = require('../../constants/topics')
const logger = require('../../lib/logger')('controller:workflow')
const audit = require('../../lib/audit')
const router = require('../../router')
// const audit = require('../../lib/audit')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const Tag = require('../../entity/tag').Entity

const ACL = require('../../lib/acl')
const dbFilter = require('../../lib/db-filter')
const AsyncController = require('../../lib/async-controller')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = function (server) {
  const CRUD_TOPIC = TopicsConstants.workflow.crud

  server.get('/workflows/v2',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    fetch
  )

  server.get('/workflows/v2/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }) ,
    (req, res, next) => {
      res.send(200, req.workflow)
      next()
    }
  )

  server.post('/workflows/v2',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    AsyncController(create),
    audit.afterCreate('workflow', { display: 'name', topic: CRUD_TOPIC })
  )

  server.del('/workflows/v2/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param: 'workflow', required: true}),
    AsyncController(remove),
    audit.afterRemove('workflow', { display: 'name', topic: CRUD_TOPIC })
  )

  server.put('/workflows/v2/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }) ,
    AsyncController(replace),
    audit.afterReplace('workflow', { display: 'name', topic: CRUD_TOPIC })
  )
}

/**
 *
 * @method GET
 *
 */
const fetch = (req, res, next) => {
  const { customer, query } = req

  const filter = dbFilter(input,{ /** default **/ })
  filter.where.customer_id = customer.id
  filter.where.version = 2
  if (!ACL.hasAccessLevel(req.user.credential,'admin')) {
    // find what this user can access
    filter.where.acl = req.user.email
  }

  Workflow.fetchBy(filter, (err, workflows) => {
    if (err) {
      return res.send(500, err)
    } else {
      res.send(200, workflows)
      next()
    }
  })
}

/**
 *
 * @method POST
 *
 */
const create = async (req, res, next) => {
  const { customer, user, body } = req

  if (body.graph.nodes.length === 0) {
    throw new ClientError('invalid graph definition')
  }

  const workflow = new Workflow(
    Object.assign({}, body, {
      _type: 'Workflow',
      customer: customer.id,
      customer_id: customer.id,
      user: user.id,
      user_id: user.id,
      version: 2
    })
  )

  const payload = { workflow, customer, user, body }
  const { tasks, graph } = await createTasks(payload)

  // updated grph with created tasks ids
  workflow.graph = graph
  await workflow.save()

  //createTags(req)
  req.workflow = workflow
  return workflow
}

/**
 *
 * @method PUT
 *
 */
const replace = async (req, res, next) => {
  const { workflow, body } = req

  if (body.graph.nodes.length === 0) {
    throw new ClientError('invalid graph definition')
  }

  const { tasks, graph } = await createTasks(req)
  await updateWorkflowGraphTasksDifferences(workflow, graph)

  workflow.set(body)
  await workflow.save()

  createTags(req)
  return workflow
}

/**
 *
 * @method DELETE
 *
 */
const remove = async (req) => {
  const { workflow, body } = req

  await Promise.all([
    workflow.remove(),
    App.Models.Job.Workflow.deleteMany({ workflow_id: workflow._id.toString() }),
    App.scheduler.unscheduleWorkflow(workflow),
    removeWorkflowTasks(workflow, body?.keepTasks)
  ])

  return
}

const createTags = ({ body, customer }) => {
  const tags = body.tags
  if (tags && Array.isArray(tags)) {
    Tag.create(tags, customer)
  }
}

const validateGraph = (graph, next) => {
  if (graph.nodes().length === 0) {
    return next(new Error('invalid graph definition'))
  }
  return next()
}

const createTaskEvent = async ({ customer_id, name, task_id }) => {
  let tEvent = await App.Models.Event.TaskEvent.findOne({
    name,
    customer_id,
    emitter_id: task_id
  })
  if (!tEvent) {
    tEvent = new App.Models.Event.TaskEvent({
      name,
      customer: customer_id,
      customer_id,
      emitter: task_id,
      emitter_id: task_id
    })
    await tEvent.save()
  }
  return tEvent
}

const createTasks = async ({ workflow, customer, user, body }) => {
  const { tasks, graph } = body
  const models = []
  //const graph = graphlib.json.read(body.graph)

  for (let node of graph.nodes) {
    const props = tasks.find(task => task.id === node.value.id)
    // is a new task
    if (props.synchronized === false) {
      const model = await App.task.factory(
        Object.assign({}, props, {
          customer_id: customer._id,
          customer: customer,
          user: user,
          user_id: user.id,
          workflow_id: workflow._id,
          workflow: workflow,
        })
      )

      if (props.id === body.start_task_id) {
        workflow.start_task = model._id
        workflow.start_task_id = model._id
      }

      // update node and edges
      const id = model._id.toString()

      // first: update the edges.
      for (let edge of graph.edges) {
        const eventName = edge.value

        if (edge.v === node.v) {
          edge.v = id

          await createTaskEvent({
            customer_id: customer._id,
            name: eventName,
            task_id: model._id
          })
        }

        if (edge.w === node.v) {
          edge.w = id

          if (isMongoId(edge.v)) {
            const task_id = ObjectId(edge.v)
            await createTaskEvent({
              customer_id: customer._id,
              name: eventName,
              task_id
            })
          }
        }
      }

      // second: update the node.
      node.value.id = node.v = id
      models.push( model )
    }
  }

  return { tasks: models, graph }
}


const removeWorkflowTasks = (workflow, keepTasks = false) => {
  const graph = workflow.graph
  const promises = []

  for (let node of graph.nodes) {
    const value = node.value

    if (keepTasks === true) {
      promises.push( App.task.unlinkTaskFromWorkflow(value.id) )
    } else {
      promises.push( App.task.destroy(value.id) )
    }
  }

  return Promise.all(promises)
}

const updateWorkflowGraphTasksDifferences = async (workflow, graph) => {
  const newgraph = graphlib.json.read(graph)
  const oldgraph = graphlib.json.read(workflow.graph)

  const oldNodes = oldgraph.nodes()

  for (let id of oldNodes) {
    const node = newgraph.node(id)
    if (!node) { // is not in the workflow no more
      const oldNode = oldgraph.node(id)
      if (workflow.version === 2) {
        await App.task.destroy(oldNode.id)
      } else {
        await App.task.unlinkTaskFromWorkflow(oldNode.id)
      }
    }
  }
}
