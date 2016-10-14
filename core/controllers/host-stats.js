var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:host-stats');
var paramResolver = require('../router/param-resolver');
var HostStats = require('../entity/host/stats').Entity;

module.exports = function(server, passport) {
  server.get('/host/:host/stats',[
    passport.authenticate('bearer', {session:false}),
    paramResolver.idToEntity({ param:'host' })
  ],controller.fetch);

  return {
    routes: [
      {
        route: '/host/:host/stats',
        method: 'get',
        middleware: [
          paramResolver.idToEntity({ param:'host' })
        ],
        action: controller.fetch
      },
    ]
  };
}

var controller = {
  fetch : function(req,res,next) {
    var host = req.host;
    var type = req.query.type;

    var query = { host_id:host._id };
    if(type) query.type = type;

    HostStats.find(query,function(error,stats){
      if(error) {
        debug.error('error fetching host stats');
        res.send(500, json.failure('internal error'));
      } else {
        var pubs = [];
        stats.forEach(function(stat){
          pubs.push(stat.publish());
        });
        res.send(200, { stats: pubs });
      }
    });
  }
}
