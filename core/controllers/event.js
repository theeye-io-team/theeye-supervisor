
const router = require('../router')
const Event = require('../entity/event').Event

module.exports = (server) => {

  /** 
  * @openapi
  * /{customer}/event:
  *   get:
  *     summary: Get a list of events
  *     description: Get a list of events from customer.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
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
  *                 $ref: '#/components/schemas/Indicator'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    controller.fetch
  )

  /** 
  * @openapi
  * /{customer}/event/{event}:
  *   get:
  *     summary: Get event
  *     description: Get a specific event from customer.
  *     tags:
  *         - Event
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Event
  *         in: query
  *         description: Event Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved event information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Event'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/event/:event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'event', required: true }),
    controller.get
  )

}

const controller = {
  fetch (req, res, next) {
    Event.fetch({
      customer: req.customer._id,
      emitter: { $ne: null }
    }, (err,events) => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200, events)
      }
    })
  },
  get (req, res, next) {
    req.send(200, req.event)
  }
}
