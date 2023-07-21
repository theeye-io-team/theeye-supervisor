var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:host-stats');
var router = require('../router');
var HostStats = require('../entity/host/stats').Entity;

module.exports = function (server) {
  var middlewares = [
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'host',required:true})
  ]

  /** 
  * @openapi
  * /{customer}/host/{host}/stats:
  *   get:
  *     summary: Get host's stats
  *     description: Get host's stats from specific customer.
  *     tags:
  *         - Host Stats
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Host
  *         in: query
  *         description: Host Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved host information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Hoststats'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/host/:host/stats', middlewares, controller.fetch)
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
