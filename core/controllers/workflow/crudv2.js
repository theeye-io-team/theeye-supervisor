
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
  const { workflow, customer, user, body } = req
  const { graph, tasks, start_task_id } = req.body

  if (body.graph.nodes.length === 0) {
    throw new ClientError('invalid graph definition')
  }

  const oldgraphlib = graphlib.json.read(workflow.graph)

  const checkRemovedNodes = async () => {
    const newgraph = graphlib.json.read(graph)
    // update removed nodes
    const oldNodes = oldgraphlib.nodes()
    for (let id of oldNodes) {
      const node = newgraph.node(id)
      if (!node) { // it is not in the workflow no more
        const oldNode = oldgraphlib.node(id)
        if (workflow.version === 2) {
          await App.task.destroy(oldNode.id)
        } else {
          await App.task.unlinkTaskFromWorkflow(oldNode.id)
        }
      }
    }
  }

  const checkCreatedNodes = async (graph) => {
    // add new nodes
    for (let node of graph.nodes) {
      if (!oldgraphlib.node(node.v)) { // is not in the workflow

        const props = tasks.find(task => {
          return (task.id === node.value.id)
        })

        const model = await App.task.factory(
          Object.assign({}, props, {
            customer_id: customer._id,
            customer: customer,
            user: user,
            user_id: user.id,
            workflow_id: workflow._id,
            workflow: workflow,
            id: undefined
          })
        )

        if (props.id === start_task_id) {
          workflow.start_task = model._id
          workflow.start_task_id = model._id
        }

        // update node and edges
        const newid = model._id.toString()

        // first: update the edges.
        for (let edge of graph.edges) {
          const eventName = edge.value

          if (edge.v === node.v) {
            edge.v = newid

            await createTaskEvent({
              customer_id: customer._id,
              name: eventName,
              task_id: model._id
            })
          }

          if (edge.w === node.v) {
            edge.w = newid

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
        node.value.id = node.v = newid
      }
    }
  }

  await checkRemovedNodes()
  await checkCreatedNodes(graph)

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

module.exports = {
  create: AsyncController(create),
  remove: AsyncController(remove),
  replace: AsyncController(replace)
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

const createTasks = async ({ workflow, customer, user, body }) => {
  const { tasks, graph } = body
  const models = []

  for (let node of graph.nodes) {
    const props = tasks.find(task => task.id === node.value.id)
    const model = await App.task.factory(
      Object.assign({}, props, {
        customer_id: customer._id,
        customer: customer,
        user: user,
        user_id: user.id,
        workflow_id: workflow._id,
        workflow: workflow,
        id: undefined
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

  return { tasks: models, graph }
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
