
const restify = require('restify')
const graphlib = require('graphlib')
const App = require('../../app')
const TopicsConstants = require('../../constants/topics')
const logger = require('../../lib/logger')('controller:workflow')
const audit = require('../../lib/audit')
const router = require('../../router')
// const audit = require('../../lib/audit')

const crudv2 = require('./crudv2')

module.exports = function (server) {
  const CRUD_TOPIC = TopicsConstants.workflow.crud

  /** 
  * @openapi
  * /workflows:
  *   get:
  *     summary: Get all workflows.
  *     description: Returns a list of all workflows.
  *     tags:
  *         - Workflow
  *     responses:
  *       '200':
  *         description: Successfully retrieved the list of workflows.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.get('/workflows',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.ensurePermissions(),
    router.dbFilter(),
    (req, res, next) => {
      const filter = req.dbQuery
      App.Models.Workflow.Workflow.fetchBy(filter, (err, workflows) => {
        if (err) {
          res.sendError(err)
        } else {
          res.send(200, workflows)
          next()
        }
      })
    }
  )

  /** 
  * @openapi
  * /workflows/{workflow}:
  *   get:
  *     summary: Get workflow.
  *     description: Returns a specific workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved workflow.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

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

  /** 
  * @openapi
  * /workflows:
  *   post:
  *     summary: Create workflow.
  *     description: Create a workflow.
  *     tags:
  *         - Workflow
  *     responses:
  *       '200':
  *         description: Successfully created workflow.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

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

  /** 
  * @openapi
  * /workflows/{workflow}:
  *   delete:
  *     summary: Delete workflow.
  *     description: Delete specific workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully deleted workflow.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.del('/workflows/:workflow',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({param: 'workflow', required: true}),
    restify.plugins.conditionalHandler([
      //{ version: '1.0.0', handler: remove },
      { version: '1.0.0', handler: crudv2.remove },
      { version: '2.9.0', handler: crudv2.remove }
    ]),
    audit.afterRemove('workflow', { display: 'name', topic: CRUD_TOPIC })
  )

  /** 
  * @openapi
  * /workflows/{workflow}:
  *   put:
  *     summary: Update workflow.
  *     description: Update specific workflow.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully updated workflow.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
    
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
//const remove = (req, res, next) => {
//  const workflow = req.workflow
//  workflow.remove(err => {
//    if (err) return res.send(500,err)
//
//    unlinkWorkflowTasks(req)
//    res.send(200)
//  })
//}
//
//const unlinkWorkflowTasks = (req) => {
//  var graph = graphlib.json.read(req.workflow.graph)
//  graph.nodes().forEach(node => {
//    var data = graph.node(node)
//    if (!/Event/.test(data._type)) {
//      App.task.unlinkTaskFromWorkflow(data.id)
//    }
//  })
//}
