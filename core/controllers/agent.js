var json = require("../lib/jsonresponse");
var Host = require(process.env.BASE_PATH + "/entity/host").Entity;
var debug = require('../lib/logger')('eye:supervisor:controller:agent');
var NotificationService = require("../service/notification");
var paramsResolver = require('../router/param-resolver');

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
    var hid = req.params.id;
    debug.log('receiving agent keep alive for %s',hid);
    var host = req.host ;
    if(!host){
      debug.error('invalid request for id %s. host not found', hid);
      return res.send(404, 'invalid host');
    }

    NotificationService.sendSNSNotification({
      'state': 'normal',
      'message': 'agent running',
      'customer_name': host.customer_name,
      'hostname': host.hostname,
      'type': 'agent'
    },{
      topic : 'events',
      subject : 'agent_update'
    });

    debug.log('agent keep alive registered');
    host.last_update = new Date();
    host.save();
    res.send(200);

    return next();
  }
};
