'use strict';

const config = require('config');
const logger = require('../lib/logger')('controller:dstat');
const router = require('../router');
const json = require('../lib/jsonresponse');
const HostStats = require('../entity/host/stats').Entity;
const NotificationService = require('../service/notification');
const ResourceManager = require('../service/resource');
const elastic = require('../lib/elastic');
const MonitorsConstants = require('../constants/monitors.js')
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')

module.exports = function (server, passport) {
  server.post('/:customer/dstat/:hostname',[
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({})
  ], controller.create)
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
 * and stored in elasticsearch if available
 *
 */
const controller = {
  create (req, res, next) {
    logger.log('Handling host dstat data')

    const host = req.host
    const customer = req.customer
    const stats = parseStats(req.body.dstat)

    if (!host) return res.send(404,'invalid host. not found')
    if (!stats) return res.send(400,'stats required')

    logger.data('dstat %j', stats)

    const generateSystemEvent = (dstat) => {
      const topic = TopicsConstants.host.stats
      const data = {
        hostname: host.hostname,
        organization: customer.name,
        model_type: 'HostStats',
        operation: (dstat !== null ? Constants.REPLACE : Constants.CREATE),
      }

      elastic.submit(customer.name, topic, Object.assign({},data,{stats: stats})) // topic = topics.host.stats
      NotificationService.generateSystemNotification({
        topic: topic,
        data: Object.assign({},data,{ model: dstat })
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
          if (err) logger.error(err)
          generateSystemEvent(dstat)
        })
      }
    })

    return res.send(200)
  }
}
