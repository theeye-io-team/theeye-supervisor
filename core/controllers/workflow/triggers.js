'use strict'

const router = require('../../router')
const resolve = router.resolve
const Event = require('../../entity/event').Event
const Workflow = require('../../lib/workflow')
const logger = require('../../lib/logger')('controller:workflow')

module.exports = (server) => {
  var middlewares = [
    server.auth.bearerMiddleware,
    resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer // requesting user is authorized to access the customer
  ]

  /** 
  * @openapi
  * /workflows/triggers:
  *   get:
  *     summary: Get workflow's triggers.
  *     description: Get specific workflow's triggers.
  *     tags:
  *         - Workflow
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
    '/workflows/triggers',
    middlewares,
    controller.get
  )
}

const controller = {
  /**
   * @method GET
   */
  get (req, res, next) {
    const customer = req.customer
    const node = req.query.node

    Event.fetch({ customer: req.customer._id }, (err, events) => {
      if (err) {
        res.sendError(err)
      } else if (!events || events.length == 0) {
        res.sendError( new Error('workflow is not available') )
      } else {

        try {
          const workflow = new Workflow()
          workflow.fromEvents(events)

          if (!node) {
            res.send(200, workflow.graph)
          } else {
            res.send(200, workflow.getPath(node))
          }
        } catch (err) {
          res.sendError(err)
        }
      }
    })
  }
}
