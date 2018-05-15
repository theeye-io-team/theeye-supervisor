
const App = require('../../app')
const TopicsConstants = require('../../constants/topics')
const logger = require('../../lib/logger')('controller:workflow')
const router = require('../../router')
// const audit = require('../../lib/audit')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const graphlib = require('graphlib')

const ACL = require('../../lib/acl');
const dbFilter = require('../../lib/db-filter');

module.exports = function (server, passport) {
  // const crudTopic = TopicsConstants.workflow.crud

  // default middlewares
  var middlewares = [
    passport.authenticate('bearer', {session: false}),
    router.resolve.customerNameToEntity({required: true}),
    router.ensureCustomer
  ]

  server.get(
    '/workflow',
    middlewares.concat([
      router.requireCredential('viewer')
    ]),
    controller.fetch
  )

  server.get(
    '/workflow/:workflow',
    middlewares.concat([
      router.requireCredential('viewer'),
      router.resolve.idToEntity({param: 'workflow', required: true}),
      router.ensureAllowed({entity: {name: 'workflow'}})
    ]),
    controller.get
  )

  server.post(
    '/workflow',
    middlewares.concat([
      router.requireCredential('admin')
    ]),
    controller.create
    // audit.afterCreate('workflow',{ display: 'name' }) // cannot audit bulk creation
  )

  server.del(
    '/workflow/:workflow',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param: 'workflow', required: true})
    ]),
    controller.remove
    // audit.afterRemove('workflow',{ display: 'name', topic: crudTopic })
  )

  server.put(
    '/workflow/:workflow',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param: 'workflow', required: true})
    ]),
    controller.replace
    // audit.afterReplace('workflow',{ display: 'name', topic: crudTopic  })
  )
}

const controller = {
  /**
   *
   * @method GET
   *
   */
  get (req, res, next) {
    res.send(200, req.workflow)
    next()
  },
  /**
   *
   * @method GET
   *
   */
  fetch (req, res, next) {
    const customer = req.customer
    const input = req.query

    const filter = dbFilter(input,{ /** default **/ })
    filter.where.customer_id = customer.id
    if (!ACL.hasAccessLevel(req.user.credential,'admin')) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    Workflow.fetchBy(filter, (err, workflows) => {
      if (err) return res.send(500, err)
      res.send(200, workflows)
      next()
    })
  },
  /**
   *
   * @method DELETE
   *
   */
  remove (req, res, next) {
  },
  /**
   *
   * @method PUT
   *
   */
  replace (req, res, next) {
  },
  /**
   *
   * @method POST
   *
   */
  create (req, res, next) {
    createWorkflow(req, (err, workflow) => {
      if (err) { return res.send(err.statusCode || 500, err) }

      assignTasksToWorkflow(req, (err) => {
        if (err) { return res.send(err.statusCode || 500, err) }

        return res.send(200, workflow)
      })
    })
  }
}

const createWorkflow = (req, next) => {
  const customer = req.customer
  const body = req.body

  var graph = graphlib.json.read(body.graph)
  if (graph.nodes().length === 0 || graph.edges().length === 0) {
    let err = new Error('invalid graph definition')
    err.statusCode = 400
    return next(err)
  }

  var workflow = new Workflow(
    Object.assign({}, body, {
      _type: 'Workflow',
      customer: customer._id,
      customer_id: customer._id,
      user: req.user._id,
      user_id: req.user._id
    })
  )

  workflow.save((err) => {
    if (err) { logger.error('%o', err) }
    req.workflow = workflow
    return next(err, workflow)
  })
}

/**
 *
 * take all the tasks on this workflow and assign to it
 *
 */
const assignTasksToWorkflow = (req, next) => {
  const workflow = req.workflow
  const graph = graphlib.json.read(workflow.graph)

  graph.nodes().forEach(id => {
    let node = graph.node(id)
    if (/Task/.test(node._type)) {
      Task.findById(id, (err, task) => {
        if (err) {
          logger.error(err)
          return next(err)
        }

        if (!task) {
          logger.error('Workflow task not found!')
          return
        }

        task.workflow_id = workflow._id
        task.workflow = workflow._id
        task.save(err => {
          if (err) {
            logger.error(err)
          } 
        })
      })
    }
  })

  next()
}

//
// NOTA MENTAL.
// No estamos preparados todavía para hacer esto
// La idea aca era que a partir de un workflow creado desde la interfaz se clone completo
// todas las tareas y eventos y se vincule todo recorriendo el workflow armado.
// esto puede traer algunos problemas al momento de intentar hacerlo. quedo sin terminar
//
///**
// *
// *
// *
// * @param {Boolean} body.copy_tasks clone all the tasks and events of the workflow
// * @param {Object} body.graph graphlib.json.read compatible object
// *
// */
//const createWorkflow = (req, next) => {
//  const customer = req.customer
//  const body = req.body
//  const copy_tasks = (req.query.copy_tasks == 'true')
//
//  const saveWorkflow = (graph) => {
//    var workflow = new Workflow(
//      Object.assign({}, body, {
//        _type: 'Workflow',
//        customer: customer._id,
//        customer_id: customer._id,
//        user: req.user._id,
//        user_id: req.user._id,
//        graph: graphlib.json.write(graph)
//      })
//    )
//
//    workflow.save((err) => {
//      if (err) { logger.error('%o', err) }
//      req.workflow = workflow
//      return next(err, workflow)
//    })
//  }
//
//  var graph = graphlib.json.read(body.graph)
//  if (graph.nodes().length === 0 || graph.edges().length === 0) {
//    let err = new Error('invalid graph definition')
//    err.statusCode = 400
//    return next(err)
//  }
//
//  if (copy_tasks===true) {
//    let first = body.first_task_id
//    buildWorkflowGraphTasks(customer, first, graph, (err, graph) => {
//      if (err) return next(err)
//      saveWorkflow(graph)
//    })
//  } else {
//    saveWorkflow(graph)
//  }
//}
//
///**
// * @param {Customer} customer
// * @param {String} first
// * @param {graphlib.Graph} graph 
// */
//const buildWorkflowGraphTasks = (customer, first, graph, next) => {
//  const workflow = new graphlib.Graph()
//  let isAcyclic = graphlib.alg.isAcyclic(graph)
//  if (isAcyclic) {
//    var node = first // this must be a task id
//  } else {
//    const err = new Error('workflows with cycles are not allowed right now')
//    return next(err)
//  }
//}
//
//const walkGraph = (graph, previous, node, end) => {
//  var data = graph.node(node)
//  var successors = graph.successors(node)
//  if (successors.length===0) {
//    logger.log('no more to walk')
//    return end()
//  }
//
//  if (successors.length>1) {
//    return end( new Error('cannot create a workflow with multiple paths') )
//  }
//
//  if (/Task/.test(data._type)) {
//    Task.findById(node, (err, task) => {
//      if (err) {
//        logger.error(err)
//        return next(err)
//      }
//
//      task.customer = customer
//      App.task.mutateNew(task, (err) => {
//        if (err) {
//          logger.error(err)
//          return end(err)
//        }
//
//        walkGraph(graph, task, successors[0], end)
//      })
//    })
//  } else if (/Event/.test(data._type)) {
//    // use previous node task to link this event to the new task created event
//  }
//}
