var json = require("../lib/jsonresponse");
var Host = require(process.env.BASE_PATH + "/entity/host").Entity;
var debug = require('../lib/logger')('eye:supervisor:controller:agent');
var NotificationService = require("../service/notification");
var paramsResolver = require('../router/param-resolver');

module.exports = function(server, passport){
	server.put('/agent/:hostname',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.hostnameToHost({})
  ],controller.update);

  return {
    routes: [
      {
        route: '/agent/:hostname',
        method: 'put',
        middleware: [ paramsResolver.hostnameToHost({}) ],
        action: controller.update
      }
    ]
  };
}

var controller = {
  update : function(req, res, next) {
    debug.log('receiving agent keep alive for %s', req.params.id);
    var host = req.host ;

    NotificationService.sendSNSNotification({
      'state'        : 'normal',
      'message'       : 'agent running',
      'customer_name' : host.customer_name,
      'hostname'      : host.hostname,
      'type'          : 'agent'
    },{
      topicArn : 'arn:aws:sns:us-east-1:691060090647:events' ,
      subject : 'agent_update' ,
      apiRoute : '/events/update'
    });

    debug.log('agent keep alive registered');
    host.last_update = new Date();
    host.save();
    res.send(200);

    return next();
  }
};
