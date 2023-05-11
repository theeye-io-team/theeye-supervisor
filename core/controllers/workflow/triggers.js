'use strict'

const router = require('../../router')
const resolve = router.resolve
const Event = require('../../entity/event').Event
const Workflow = require('../../lib/workflow')
const logger = require('../../lib/logger')('controller:workflow')

module.exports = (server) => {
  server.get('/workflows/triggers',
    server.auth.bearerMiddleware,
    resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer, // requesting user is authorized to access the customer
    controller.get
  )
}

var controller = {
  /**
   * @method GET
   */
  get (req, res, next) {
    var customer = req.customer
    var node = req.query.node

    Event.fetch({ customer: req.customer._id }, (err, events) => {
      if (err) {
        logger.error(err.message)
        logger.debug('%o', err)
        return res.send(500, err)
      }

      if (!events || events.length == 0) {
        return res.send(500, 'workflow is not available')
      }

      try {
        var workflow = new Workflow()
        workflow.fromEvents(events)

        if (!node) {
          return res.send(200, workflow.graph)
        } else {
          return res.send(200, workflow.getPath(node))
        }
      } catch (err) {
        logger.error(err.message)
        logger.debug('%o', err)
        return res.send(500, err)
      }
    })
  }
}
