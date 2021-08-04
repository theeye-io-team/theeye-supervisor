
const router = require('../router')
const Event = require('../entity/event').Event

module.exports = (server) => {

  server.get('/:customer/event',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    controller.fetch
  )

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
