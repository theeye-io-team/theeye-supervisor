
const restify = require('restify')
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

const ACL = require('../../lib/acl');
const dbFilter = require('../../lib/db-filter');

const crudv2 = require('./crudv2')

module.exports = function (server) {
  const CRUD_TOPIC = TopicsConstants.workflow.crud

  server.get('/workflows',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    fetch
  )

  server.get('/workflows/:workflow',
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

  server.post('/workflows',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    restify.plugins.conditionalHandler([
      { version: '2.9.0', handler: crudv2.create }
    ]),
    audit.afterCreate('workflow', { display: 'name', topic: CRUD_TOPIC })
  )

  server.del('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param: 'workflow', required: true}),
    restify.plugins.conditionalHandler([
      { version: '1.0.0', handler: remove },
      { version: '2.9.0', handler: crudv2.remove }
    ]),
    audit.afterRemove('workflow', { display: 'name', topic: CRUD_TOPIC })
  )

  server.put('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }) ,
    restify.plugins.conditionalHandler([
      { version: '2.9.0', handler: crudv2.replace }
    ]),
    audit.afterReplace('workflow', { display: 'name', topic: CRUD_TOPIC })
  )
}

/**
 *
 * @method GET
 *
 */
const fetch = (req, res, next) => {
  const { customer, input = {} } = req

  const filter = dbFilter(input, { /** default **/ })
  filter.where.customer_id = customer.id
  if (!ACL.hasAccessLevel(req.user.credential,'admin')) {
    // find what this user can access
    filter.where.acl = req.user.email
  }

  App.Models.Workflow.Workflow.fetchBy(filter, (err, workflows) => {
    if (err) return res.send(500, err)
    res.send(200, workflows)
    next()
  })
}

const remove = (req, res, next) => {
  const workflow = req.workflow
  workflow.remove(err => {
    if (err) return res.send(500,err)

    unlinkWorkflowTasks(req)
    res.send(200)
  })
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
