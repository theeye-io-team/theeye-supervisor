'use strict'

var router = require('../../router')
var resolve = router.resolve
var async = require('async')
var Event = require('../../entity/event').Event
var Workflow = require('../../lib/workflow')
const logger = require('../../lib/logger')('controller:workflow')

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session: false }),
    resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer // requesting user is authorized to access the customer
  ]

  server.get(
    '/workflow/:id/graph',
    middlewares,
    controller.get
  )
}

var controller = {
  /**
   * @method GET
   */
  get (req, res, next) {
    var customer = req.customer
    var workflow = req.params.workflow
    return res.send(200, {})

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
