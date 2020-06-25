'use strict'

const resolver = require('../router/param-resolver')
const Event = require('../entity/event').Event

module.exports = function (server) {
  server.get('/:customer/event/:event',[
    server.auth.bearerMiddleware,
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'event' })
  ], controller.get)

  server.get('/:customer/event',[
    server.auth.bearerMiddleware,
    resolver.customerNameToEntity({})
  ], controller.fetch)
}

var controller = {
  get (req, res, next) {
    if (!req.event) req.send(404)
    req.send(200, req.event)
  },
  fetch (req, res, next) {
    Event.fetch({ customer: req.customer._id, emitter: { $ne: null } },(err,events) => {
      if (err) res.send(500)
      res.send(200, events)
    })
  }
}
