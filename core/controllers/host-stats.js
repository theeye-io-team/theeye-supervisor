var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:host-stats');
var router = require('../router');
var HostStats = require('../entity/host/stats').Entity;

module.exports = function (server) {
  server.get('/:customer/host/:host/stats',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'host',required:true}),
    controller.fetch
  )
}

const controller = {
  fetch (req,res,next) {
    const customer = req.customer
    const host = req.host
    const type = req.query.type

    var query = {
      host_id: host._id,
      customer_name: customer.name
    }

    if (type) query.type = type

    HostStats.find(query, (error, stats) => {
      if (error) {
        debug.error('error fetching host stats')
        res.send(500, json.failure('internal error'))
      } else {
        res.send(200, stats)
      }
    })
  }
}
