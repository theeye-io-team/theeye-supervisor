"use strict";
var json = require("../lib/jsonresponse");
var logger = require('../lib/logger')('controller:agent');
var NotificationService = require("../service/notification");
var paramsResolver = require('../router/param-resolver');
var Host = require("../entity/host").Entity;
var ResourceManager = require("../service/resource");


module.exports = function(server, passport){
	server.put('/:customer/agent/:hostname',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ],controller.update);

  /**
  return {
    routes: [
      {
        route: '/agent/:hostname',
        method: 'put',
        middleware: [
          paramsResolver.customerNameToEntity({}),
          paramsResolver.hostnameToHost({}) 
        ],
        action: controller.update
      }
    ]
  };
  */
}

var controller = {
  update (req, res, next) {
    var host = req.host ;
    if(!host){
      logger.error('invalid request for id %s. host not found', req.params.hostname);
      return res.send(404,'invalid host');
    }

    logger.log('receiving agent keep alive for host "%s"',host.hostname);

    host.last_update = new Date();
    host.save(err=>{
      if(err) return logger.error(err);
      let options = {
        'type':'host',
        'ensureOne':true
      };
      ResourceManager.findHostResources(host,options,(err,resource)=>{
        if(err||!resource)return;
        var handler = new ResourceManager(resource);
        handler.handleState({ state:'normal' });
      });
    });

    res.send(200);
    return next();
  }
};
