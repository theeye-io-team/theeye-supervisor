"use strict";
var json = require("../lib/jsonresponse");
var logger = require('../lib/logger')('eye:supervisor:controller:agent');
var NotificationService = require("../service/notification");
var paramsResolver = require('../router/param-resolver');
var Host = require("../entity/host").Entity;
var Resource = require("../entity/resource").Entity;
var ResourceManager = require("../service/resource");


module.exports = function(server, passport){
	server.put('/agent/:hostname',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ],controller.update);

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
}

var controller = {
  update : function(req, res, next) {
    var host = req.host ;
    if(!host){
      logger.error('invalid request for id %s. host not found', req.params.hostname);
      return res.send(404,'invalid host');
    }

    logger.log('receiving agent keep alive for host "%s"',host.hostname);

    host.last_update = new Date();
    host.save(err=>{
      if(err) return logger.error(err);
      Resource.find({
        'type':'host',
        'host_id': host._id
      },(err,resources)=>{
        if(err) return logger.error(err);
        if(!resources||resources.length===0) return logger.log('host resource not available');
        if(resources.length>1) logger.error('many host resources found!');

        var resource = resources[0];
        var handler = new ResourceManager(resource);
        handler.handleState({
          state:'normal',
          message:'agent running'
        });
      });
    });

    res.send(200);
    return next();
  }
};
