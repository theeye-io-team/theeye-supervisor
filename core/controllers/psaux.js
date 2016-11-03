'use strict';

var json = require('../lib/jsonresponse');
var HostStats = require('../entity/host/stats').Entity;
var NotificationService = require('../service/notification');
var logger = require('../lib/logger')('controller:dstat');
var resolver = require('../router/param-resolver');
var ResourceManager = require('../service/resource');

module.exports = function(server, passport) {
	server.post('/:customer/psaux/:hostname', [
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.hostnameToHost({})
  ], controller.create);

	server.post('/psaux/:hostname', [
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.hostnameToHost({})
  ], controller.create);
}

var controller = {
  create (req, res, next) {
    var host = req.host ;
    var stats = req.params.psaux ;

    if(!host) return res.send(404,'host not found');
    if(!stats) return res.send(400,'psaux data required');

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
      handler.handleState({
        last_update: new Date(),
        state: 'normal'
      });
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
