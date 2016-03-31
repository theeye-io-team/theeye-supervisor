var json = require("../lib/jsonresponse");
var HostStats = require("../entity/host/stats").Entity;
var debug = require("../lib/logger")("eye:supervisor:controller:dstat");
var NotificationService = require("../service/notification");
var paramsResolver = require('../router/param-resolver');

var elastic = require('../lib/elastic');

module.exports = function(server, passport) {
  server.post('/dstat/:hostname',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ],controller.create);

  return {
    routes: [
      {
        route: '/dstat/:hostname',
        method: 'post',
        middleware: [
          paramsResolver.customerNameToEntity({}),
          paramsResolver.hostnameToHost({})
        ],
        action: controller.create
      }
    ]
  }
}

var controller = {
  create : function create(req, res, next) {
    debug.log('Handling host dstat data');

    var host = req.host;
    if(host===null) return res.send(404);

    var customer = req.customer;
    var stats = req.params.dstat;

    if(!stats) return res.send(400);

    HostStats.findOneByHostAndType( host._id, 'dstat',
      function(error,dstat){
        if(error) {
          debug.error(error);
        } else if(dstat == null) {
          debug.log('creating host dstat');
          HostStats.create(host,'dstat',stats);
        } else {
          debug.log('updating host dstat');

          var date = new Date();
          dstat.last_update = date ;
          dstat.last_update_timestamp = date.getTime() ;
          dstat.stats = stats ;
          dstat.save();
        }
      }
    );
    
    var data = {
      timestamp: (new Date()).getTime(),
      date:(new Date()).toISOString(),
      customer_name: customer.name,
      hostname: host.hostname,
      stats: req.params.dstat,
      type: 'host-stats'
    };

    //elastic.submit(customer.name,'hoststats', data);
    elastic.submit(customer.name,'host-stats', data);

    NotificationService.sendSNSNotification(data,{
      topic: 'host-stats',
      subject: 'dstat_update'
    });

    return res.send(200);
  }
};
