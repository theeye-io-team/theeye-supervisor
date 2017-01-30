var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:host-stats');
var router = require('../router');
var HostStats = require('../entity/host/stats').Entity;

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'host',required:true})
  ];
  server.get('/:customer/host/:host/stats',middlewares,controller.fetch);
}

var controller = {
  fetch (req,res,next) {
    var host = req.host;
    var type = req.query.type;

    var query = { host_id: host._id };
    if(type) query.type = type;

    HostStats.find(query,function(error,stats){
      if(error) {
        debug.error('error fetching host stats');
        res.send(500, json.failure('internal error'));
      } else {
        res.send(200, stats);
      }
    });
  }
}
