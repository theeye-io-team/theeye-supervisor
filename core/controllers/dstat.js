'use strict';

var json = require('../lib/jsonresponse');
var HostStats = require('../entity/host/stats').Entity;
var NotificationService = require('../service/notification');
var logger = require('../lib/logger')('controller:dstat');
var router = require('../router');
var config = require('config');

var ResourceManager = require('../service/resource');
var elastic = require('../lib/elastic');

module.exports = function(server, passport){
  server.post('/:customer/dstat/:hostname',[
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({})
  ],controller.create);
}

function parseStats (stats) {
  if (!isNaN(parseInt(stats.cpu_idle))) {
    if (!stats.cpu_used) {
      stats.cpu_used = 100 - stats.cpu_idle;
    }
  }
  return stats;
}

var controller = {
  create (req, res, next) {
    logger.log('Handling host dstat data');

    var host = req.host,
      customer = req.customer,
      stats = parseStats(req.body.dstat);

    if (!host) return res.send(404,'host not found');
    if (!stats) return res.send(400,'no stats supplied');

    HostStats.findOne({
      host_id: host._id,
      type:'dstat'
    },function(error,dstat){
      if(error) return logger.error(error);
      if(dstat == null) {
        logger.log('creating host dstat');
        HostStats.create(host,'dstat',stats);
      } else {
        logger.log('updating host dstat');

        var date = new Date();
        dstat.last_update = date;
        dstat.last_update_timestamp = date.getTime();
        dstat.stats = stats;
        dstat.save();
      }
    });

    /**
    ResourceManager.findHostResources(host,options,(err,resource)=>{
      if(err||!resource)return;
      var handler = new ResourceManager(resource);
      handler.handleState({
        last_update: new Date(),
        state: 'normal'
      });
    });
    */

    logger.log('resending dstat data');

    var data = {
      'timestamp': (new Date()).getTime(),
      'date': (new Date()).toISOString(),
      'customer_name': customer.name,
      'hostname': host.hostname,
      'stats': req.body.dstat,
      'type': 'host-stats'
    };

    logger.data('dstat %j', data);

    var key = config.elasticsearch.keys.host.stats;
    elastic.submit(customer.name,key,data);

    NotificationService.sendSNSNotification(data,{
      topic: 'host-stats',
      subject: 'dstat_update'
    });

    return res.send(200);
  }
};
