'use strict'

const router = require('../../router')
const resolve = router.resolve
const Event = require('../../entity/event').Event
const Workflow = require('../../lib/workflow')
const logger = require('../../lib/logger')('controller:workflow')

module.exports = function (server, passport) {
  var middlewares = 

  server.get(
    '/workflows/:id/graph',
    [
      passport.authenticate('bearer', { session: false }),
      resolve.customerNameToEntity({ required: true }),
      router.ensureCustomer, // requesting user is authorized to access the customer
      router.resolve.idToEntity({ param: 'workflow', required: true }),
      router.ensureAllowed({ entity: { name: 'workflow' } })
    ],
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
