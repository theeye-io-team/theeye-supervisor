
const App = require('../app')
const Constants = require('../constants')
const MonitorsConstants = require('../constants/monitors')
const HostStats = require('../entity/host/stats').Entity;
const logger = require('../lib/logger')('controller:dstat');
const router = require('../router');

const TopicsConstants = require('../constants/topics')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.requireCredential('agent',{exactMatch:true}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({required:true})
  ]

  /** 
  * @openapi
  * /{customer}/psaux/{hostname}:
  *   post:
  *     summary: Create psaux
  *     description: Create psaux for specific customer.
  *     tags:
  *         - Psaux
  *     parameters:
  *       - name: Host
  *         in: query
  *         description: Host Name
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully created.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Psaux'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

	server.post('/:customer/psaux/:hostname', middlewares, create)

  /** 
  * @openapi
  * /psaux/{hostname}:
  *   get:
  *     summary: Create psaux
  *     description: Create psaux for specific customer.
  *     tags:
  *         - Psaux
  *     parameters:
  *       - name: Host
  *         in: query
  *         description: Host Name
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully created host group.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Psaux'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

	server.post('/psaux/:hostname', middlewares, create)
}

const create = async (req, res) => {
  try {
    let host = req.host
    let stats = req.body.psaux

    if (!host) {
      let err = new Error('host is not valid or was removed')
      err.statusCode = 400
      throw err
    }

    if (!stats) {
      let err = new Error('processes data required')
      err.statusCode = 400
      throw err
    }

    logger.log('Handling host psaux data')

    let psaux = await HostStats.findOne({
      host_id: host._id,
      type: MonitorsConstants.RESOURCE_TYPE_PSAUX
    })

    if (psaux === null) {
      logger.log('creating host psaux')
      HostStats.create(host, MonitorsConstants.RESOURCE_TYPE_PSAUX, stats, (err, psaux) => {
        App.notifications.generateSystemNotification({
          topic: TopicsConstants.host.processes,
          data: {
            model_id: psaux._id,
            model_type: 'HostStats',
            //model: psaux,
            hostname: host.hostname,
            organization: host.customer_name,
            operation: Constants.CREATE
          }
        })
      })
    } else {
      logger.log('updating host psaux')
      var date = new Date()

      await HostStats.updateOne({ _id: psaux._id }, {
        last_update: date,
        last_update_timestamp: date.getTime(),
        stats
      })

      App.notifications.generateSystemNotification({
        topic: TopicsConstants.host.processes,
        data: {
          model_id: psaux._id,
          model_type: 'HostStats',
          //model: psaux,
          hostname: host.hostname,
          organization_id: host.customer_id,
          organization: host.customer_name,
          operation: Constants.REPLACE
        }
      })
    }

    App.resource.findHostResources(host, { type: 'psaux', ensureOne: true }, (err, resource) => {
      if (!resource) { return }
      let handler = new App.resource(resource)
      handler.handleState({ state: MonitorsConstants.RESOURCE_NORMAL })
    })

    res.send(200)

  } catch (err) {
    logger.error(err)
    res.send(err.statusCode, err.message)
  }
}
