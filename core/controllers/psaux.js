var json = require("../lib/jsonresponse");
var HostStats = require("../entity/host/stats").Entity;
var NotificationService = require('../service/notification');
var debug = require("../lib/logger")('eye:supervisor:controller:psaux');
var paramsResolver = require('../router/param-resolver');

module.exports = function(server, passport) {
	server.post('/psaux/:hostname', [
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ], controller.create);
}

var controller = {
  create : function create(req, res, next) {
    var host = req.host ;
    var stats = req.params.psaux ;

    if(!host) return res.send(404,'host not found');
    if(!stats) return res.send(400,'psaux data required');

    debug.log('Handling host psaux data');

    HostStats.findOneByHostAndType(
      host._id,
      'psaux',
      function(error,psaux){
        if(error) {
          debug.error(error);
        } else if(psaux == null) {
          debug.log('creating host psaux');
          HostStats.create(host,'psaux',stats);
        } else {
          debug.log('updating host psaux');

          var date = new Date();
          psaux.last_update = date ;
          psaux.last_update_timestamp = date.getTime() ;
          psaux.stats = stats ;
          psaux.save();
        }
      }
    );

    NotificationService.sendSNSNotification({
      timestamp: (new Date()).getTime(),
      stat: req.params.psaux,
      customer_name: host.customer_name,
      hostname: host.hostname,
      type: "psaux"
    },{
      topic: "host-stats",
      subject: "psaux_update"
    });

    res.send(200); 

    return next();
  }
};
