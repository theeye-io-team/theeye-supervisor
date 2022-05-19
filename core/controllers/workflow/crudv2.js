
const ObjectId = require('mongoose').Types.ObjectId
const isMongoId = require('validator/lib/isMongoId')
const graphlib = require('graphlib')
const App = require('../../app')
//const logger = require('../../lib/logger')('controller:workflow:crudv2')
const AsyncController = require('../../lib/async-controller')
const { ClientError, ServerError } = require('../../lib/error-handler')
//const formidable = require('formidable')
//const form = formidable({ multiples: true })

module.exports = {
  /**
   *
   * @method POST
   *
   */
  create: AsyncController(async (req, res, next) => {
    const { customer, user, body } = req

    const inputGraph = body.graph
    if (
      !inputGraph ||
      !inputGraph.nodes ||
      !Array.isArray(inputGraph.nodes) ||
      inputGraph.nodes.length === 0
    ) {
      throw new ClientError('invalid graph definition')
    }

    if (
      !body.tasks ||
      !Array.isArray(body.tasks) ||
      body.tasks.length === 0
    ) {
      throw new ClientError('cannot create a workflow without tasks')
    }

    const workflow = new App.Models.Workflow.Workflow(
      Object.assign({}, body, {
        _type: 'Workflow',
        customer: customer.id,
        customer_id: customer.id,
        user: user.id,
        user_id: user.id,
        version: 2
      })
    )

    //if (workflow.errors) {
    //  const key = Object.keys(workflow.errors)[0] 
    //  const err = workflow.errors[key].reason
    //  throw new ClientError(`${key}: ${err.message}`)
    //}

    const payload = { workflow, customer, user, body }
    const { tasks, graph } = await createTasks(payload)

    // updated grph with created tasks ids
    workflow.graph = graph
    await workflow.save()

    //createTags(req)
    req.workflow = workflow
    return workflow
  }),
  /**
   *
   * @method DELETE
   *
   */
  remove: AsyncController(async (req) => {
    const { workflow, body, query } = req

    const keepTasks = (query?.keepTasks==='true' || query?.keepTasks===true)

    await Promise.all([
      workflow.remove(),
      App.Models.Job.Workflow.deleteMany({ workflow_id: workflow._id.toString() }),
      App.scheduler.unscheduleWorkflow(workflow),
      removeWorkflowTasks(workflow, keepTasks)
    ])

    return
  }),
  /**
   *
   * @method PUT
   *
   */
  replace: AsyncController(async (req, res, next) => {
    const { workflow, customer, user } = req
    const { tasks, start_task_id } = req.body

    if (req.body.graph.nodes.length === 0) {
      throw new ClientError('invalid graph definition')
    }

    // copy to not altere original req.body
    const props = Object.assign({}, req.body)
    delete props.graph
    delete props.start_task_id
    delete props.tasks
    
    workflow.set(props) // update. will be saved at then end
    if (isMongoId(start_task_id)) {
      workflow.set({ start_task_id })
    }

    const oldgraphlib = graphlib.json.read(workflow.graph)
    const newgraphlib = graphlib.json.read(req.body.graph)
    const newgraphplain = graphlib.json.write(newgraphlib)

    const checkRemovedNodes = async () => {
      // update removed nodes
      const oldNodes = oldgraphlib.nodes()
      for (let id of oldNodes) {
        const node = newgraphlib.node(id)
        if (!node && isMongoId(id)) { // it is not in the workflow no more
          const oldNode = oldgraphlib.node(id)
          if (workflow.version === 2) {
            await App.task.destroy(oldNode.id)
          } else {
            await App.task.unlinkTaskFromWorkflow(oldNode.id)
          }
        }
      }
    }

    const checkCreatedNodes = async () => {
      // add new nodes
      for (let node of newgraphplain.nodes) {
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
          for (let edge of newgraphplain.edges) {
            const eventName = edge.value

            if (edge.v === node.v) {
              edge.v = newid

              await createTaskEvent({
                customer_id: customer._id,
                name: eventName,
                task_id: model._id
              })
            } else if (edge.w === node.v) {
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
    await checkCreatedNodes()
    await updateTasksAcl(newgraphplain, workflow)


    workflow.graph = newgraphplain
    await workflow.save()

    createTags(req)
    return workflow
  })
}

const updateTasksAcl = (graph, workflow) => {
  const updateAcls = []
  for (let node of graph.nodes) {
    updateAcls.push(
      App.Models.Task.Task
      .findById(node.value.id)
      .then(task => {
        task.acl = workflow.acl
        return task.save()
      })
      .catch(err => {
        logger.error(err)
        return err
      })
    )
  }
  return Promise.all(updateAcls)
}

const createTags = ({ body, customer }) => {
  const tags = body.tags
  if (tags && Array.isArray(tags)) {
    App.Models.Tag.Tag.create(tags, customer)
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
        customer,
        user,
        user_id: user.id,
        workflow_id: workflow._id,
        workflow
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

const removeWorkflowTasks = async (workflow, keepTasks = false) => {
  const promises = []

  const tasks = await App.Models.Task.Task.find({
    workflow_id: workflow._id
  })

  for (let task of tasks) {
    if (keepTasks === true) {
      promises.push( App.task.unlinkTaskFromWorkflow(task._id) )
    } else {
      promises.push( App.task.destroy(task._id) )
    }
  }

  return Promise.all(promises)
}
