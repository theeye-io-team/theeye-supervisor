'use strict'

const router = require('../../router')
const resolve = router.resolve
const Event = require('../../entity/event').Event
const Workflow = require('../../lib/workflow')
const logger = require('../../lib/logger')('controller:workflow')

module.exports = function (server) {

  /** 
  * @openapi
  * /workflows/{id}/graph:
  *   get:
  *     summary: Get workflow graph.
  *     description: Returns a workflow graph.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Id
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved workflow information.
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

  server.get(
    '/workflows/:id/graph',
    server.auth.bearerMiddleware,
    resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer, // requesting user is authorized to access the customer
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    controller.get
  )
}

var controller = {
  /**
   * @method GET
   */
  get (req, res, next) {
    const workflow = req.workflow
    res.send(200, workflow.graph)
  }
}
