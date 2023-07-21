
const App = require('../app')
const config = require('config');
const logger = require('../lib/logger')('controller:dstat');
const router = require('../router');
const json = require('../lib/jsonresponse');
const HostStats = require('../entity/host/stats').Entity;
const ResourceManager = require('../service/resource');
const MonitorsConstants = require('../constants/monitors.js')
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')

module.exports = function (server) {

  /** 
  * @openapi
  * /{customer}/dstat/{hostname}:
  *   post:
  *     summary: Create dstat.
  *     description: Create dstat.
  *     tags:
  *       - Dstat
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Hostname
  *         in: query
  *         description: Host name
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Dstat'
  *     responses:
  *       '201':
  *         description: Dstat created successfully.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Dstat'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/:customer/dstat/:hostname',[
    server.auth.bearerMiddleware,
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({})
  ], create)
}

const parseStats = (stats) => {
  if (!isNaN(parseInt(stats.cpu_idle))) {
    if (!stats.cpu_used) {
      stats.cpu_used = 100 - stats.cpu_idle;
    }
  }
  return stats;
}

/**
 *
 * @summary store agent dstat collected data
 * @param {Host} req.host
 * @param {Customer} req.customer
 * @param {Object} req.body.dstat
 *
 * the monitoring information is being display via web interface
 *
 */
const create = (req, res, next) => {
  logger.log('Handling host dstat data')

  const host = req.host
  const customer = req.customer
  const stats = parseStats(req.body.dstat)

  /**
   * dont save stats. are generating errors and collapse notifications
   */
  if (stats.net) {
    delete stats.net
  }

  if (!host) return res.send(404,'invalid host. not found')
  if (!stats) return res.send(400,'stats required')

  logger.data('dstat %j', stats)

  const generateSystemEvent = (dstat) => {
    const topic = TopicsConstants.host.stats
    const data = {
      hostname: host.hostname,
      organization: customer.name,
      organization_id: customer._id,
      model_id: dstat._id,
      model_type: 'HostStats',
      operation: (dstat !== null ? Constants.REPLACE : Constants.CREATE),
    }

    App.logger.submit(customer.name, topic, Object.assign({}, data, {stats})) // topic = topics.host.stats
    App.notifications.generateSystemNotification({
      topic,
      data: Object.assign({}, data, { model: dstat })
    })
  }

  HostStats.findOne({
    host_id: host._id,
    type: MonitorsConstants.RESOURCE_TYPE_DSTAT
  }, (error, dstat) => {
    if (error) return logger.error(error)

    if (dstat == null) {
      logger.log('creating host dstat')
      HostStats.create(
        host,
        MonitorsConstants.RESOURCE_TYPE_DSTAT,
        stats,
        (err,dstat) => {
          if (err) return logger.error(err)
          generateSystemEvent(dstat)
        })
    } else {
      logger.log('updating host dstat')
      var date = new Date()
      dstat.last_update = date
      dstat.last_update_timestamp = date.getTime()
      dstat.stats = stats
      dstat.save(err => {
        if (err) {
          logger.error(err)
        }
        generateSystemEvent(dstat)
      })
    }
  })

  return res.send(200)
}
