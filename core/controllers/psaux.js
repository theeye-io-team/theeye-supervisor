'use strict';

const Constants = require('../constants')
const MonitorsConstants = require('../constants/monitors')
var json = require('../lib/jsonresponse');
var HostStats = require('../entity/host/stats').Entity;
var NotificationService = require('../service/notification');
var logger = require('../lib/logger')('controller:dstat');
var router = require('../router');
var ResourceManager = require('../service/resource');

const TopicsConstants = require('../constants/topics')

module.exports = function (server, passport) {
  const middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('agent',{exactMatch:true}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({required:true})
  ]

	server.post(
    '/:customer/psaux/:hostname',
    middlewares,
    controller.create
  )

  /**
   *
   * KEEP ROUTE FOR OUTDATED AGENTS
   *
   */
	server.post(
    '/psaux/:hostname',
    middlewares,
    controller.create
  )
}

const controller = {
  create (req, res, next) {
    var host = req.host
    var stats = req.body.psaux

    if (!host) {
      var errmsg = 'host is not valid or was removed'
      logger.error(errmsg)
      return res.send(400,errmsg)
    }
    if (!stats) {
      return res.send(400,'psaux data required')
    }

    logger.log('Handling host psaux data');

    const topic = TopicsConstants.host.processes

    HostStats.findOne({
      host_id: host._id,
      type: 'psaux'
    },function(error,psaux){
      if (error) {
        return logger.error(error);
      }

      if (psaux === null) {
        logger.log('creating host psaux');
        HostStats.create(host,'psaux',stats,(err,psaux) => {
          NotificationService.generateSystemNotification({
            topic: topic,
            data: {
              model_type: 'HostStats',
              model: psaux,
              hostname: host.hostname,
              organization: host.customer_name,
              operation: Constants.CREATE
            }
          })
        })
      } else {
        logger.log('updating host psaux')
        var date = new Date()
        psaux.last_update = date
        psaux.last_update_timestamp = date.getTime()
        psaux.stats = stats
        psaux.save()

        NotificationService.generateSystemNotification({
          topic: topic,
          data: {
            model_type: 'HostStats',
            model: psaux,
            hostname: host.hostname,
            organization: host.customer_name,
            operation: Constants.REPLACE
          }
        })
      }
    });

    ResourceManager.findHostResources(host,{
      type:'psaux',
      ensureOne:true
    },(err,resource)=>{
      if(err||!resource)return;
      var handler = new ResourceManager(resource);
      handler.handleState({ state: MonitorsConstants.RESOURCE_NORMAL })
    });

    res.send(200)
    return next()
  }
};
