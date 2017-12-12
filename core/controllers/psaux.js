'use strict';

const MONITORS = require('../constants/monitors')
var json = require('../lib/jsonresponse');
var HostStats = require('../entity/host/stats').Entity;
var NotificationService = require('../service/notification');
var logger = require('../lib/logger')('controller:dstat');
var router = require('../router');
var ResourceManager = require('../service/resource');

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('agent',{exactMatch:true}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({required:true})
  ];

	server.post('/:customer/psaux/:hostname',middlewares,controller.create);
  /**
   *
   * KEEP ROUTE FOR OUTDATED AGENTS
   *
   */
	server.post('/psaux/:hostname',middlewares,controller.create);
}

var controller = {
  create (req, res, next) {
    var host = req.host
    var stats = req.params.psaux

    if (!host) {
      var errmsg = 'host is not valid or was removed'
      logger.error(errmsg)
      return res.send(400,errmsg)
    }
    if (!stats) return res.send(400,'psaux data required')

    logger.log('Handling host psaux data');

    HostStats.findOne({
      host_id: host._id,
      type: 'psaux'
    },function(error,psaux){
      if(error) {
        logger.error(error);
      } else if(psaux == null) {
        logger.log('creating host psaux');
        HostStats.create(host,'psaux',stats);
      } else {
        logger.log('updating host psaux');

        var date = new Date();
        psaux.last_update = date ;
        psaux.last_update_timestamp = date.getTime() ;
        psaux.stats = stats ;
        psaux.save();
      }
    });

    ResourceManager.findHostResources(host,{
      type:'psaux',
      ensureOne:true
    },(err,resource)=>{
      if(err||!resource)return;
      var handler = new ResourceManager(resource);
      handler.handleState({ state: MONITORS.RESOURCE_NORMAL })
    });

    NotificationService.sendSNSNotification({
      'timestamp': (new Date()).getTime(),
      'stat': req.params.psaux,
      'customer_name': host.customer_name,
      'hostname': host.hostname,
      'type': 'psaux'
    },{
      'topic': 'host-stats',
      'subject': 'psaux_update'
    });

    res.send(200); 
    return next();
  }
};
