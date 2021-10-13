
const graphlib = require('graphlib')
const App = require('../../app')
const TopicsConstants = require('../../constants/topics')
const logger = require('../../lib/logger')('controller:workflow')
const router = require('../../router')
// const audit = require('../../lib/audit')
const Workflow = require('../../entity/workflow').Workflow
const Task = require('../../entity/task').Entity
const Tag = require('../../entity/tag').Entity

const ACL = require('../../lib/acl');
const dbFilter = require('../../lib/db-filter');

module.exports = function (server) {
  const crudTopic = TopicsConstants.workflow.crud

  server.get('/workflows',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer') ,
    controller.fetch
  )

  server.get('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }) ,
    controller.get
  )

  server.del('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param: 'workflow', required: true}) ,
    controller.remove
    audit.afterRemove('workflow',{ display: 'name', topic: crudTopic })
  )

  server.put('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param: 'workflow', required: true}) ,
    controller.replace
    audit.afterReplace('workflow',{ display: 'name', topic: crudTopic  })
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
    var workflow = req.workflow
    workflow.remove(err => {
      if (err) return res.send(500,err)

      unlinkWorkflowTasks(req)
      res.send(200)
    })
  },
  /**
   *
   * @method PUT
   *
   */
  replace (req, res, next) {
    replaceWorkflow(req, (err, workflow) => {
      if (err) {
        return res.send(err.statusCode || 500, err)
      }

      assignWorkflowAclToTasks(workflow, (err) => {
        if (err) { return res.send(err.statusCode || 500, err) }

        res.send(200, workflow)
      })
    })
  }
}

const unlinkWorkflowTasks = (req) => {
  var graph = graphlib.json.read(req.workflow.graph)
  graph.nodes().forEach(node => {
    var data = graph.node(node)
    if (!/Event/.test(data._type)) {
      App.task.unlinkTaskFromWorkflow(data.id)
    }
  })
}

const replaceWorkflow = (req, next) => {
  const workflow = req.workflow
  const body = req.body
  const newgraph = graphlib.json.read(body.graph)
  const oldgraph = graphlib.json.read(workflow.graph)

  validateGraph(newgraph, (err) => {
    if (err) {
      err.statusCode = 400
      return next(err)
    }

    workflow.set(body)
    workflow.save(err => {
      if (err) {
        logger.error('%s, %s, errors: %o',err.name, err.message, err.errors)
        if (err.name === 'ValidationError') {
          err.statusCode = 400
        }
        return next(err)
      }

      updateWorkflowGraphTasksDiferences(oldgraph, newgraph, workflow)
      createTags(body.tags, req.customer)

      next(err, workflow)
    })
  })
}

const createTags = (tags, customer) => {
  if (tags && Array.isArray(tags)) {
    Tag.create(tags, customer)
  }
}

const validateGraph = (graph, next) => {
  if (graph.nodes().length === 0 || graph.edges().length === 0) {
    return next(new Error('invalid graph definition'))
  }
  return next()
}

const updateWorkflowGraphTasksDiferences = (oldgraph, newgraph, workflow) => {
  newgraph.nodes().forEach(id => {
    let node = oldgraph.node(id)
    if (!node) { // is new
      node = newgraph.node(id)
      if (!/Event/.test(node._type)) {
        App.task.assignTaskToWorkflow(id, workflow)
      }
    }
  })
  oldgraph.nodes().forEach(id => {
    let node = newgraph.node(id)
    if (!node) { // is no more in the workflow
      node = oldgraph.node(id)
      if (!/Event/.test(node._type)) {
        App.task.unlinkTaskFromWorkflow(id)
      }
    }
  })
}

const assignWorkflowAclToTasks = (workflow, next) => {
  const graph = graphlib.json.read(workflow.graph)

  graph.nodes().forEach(id => {
    let node = graph.node(id)
    if (!/Event/.test(node._type)) {
      App.task.assignWorkflowAclToTask(id, workflow)
    }
  })

  next()
}
