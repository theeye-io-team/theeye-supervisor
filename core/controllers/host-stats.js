var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:host-stats');
var resolver = require('../router/param-resolver');
var HostStats = require('../entity/host/stats').Entity;

module.exports = function(server, passport) {
  server.get('/:customer/host/:host/stats',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({required:true}),
    resolver.idToEntity({param:'host',required:true})
  ],controller.fetch);
}

var controller = {
  fetch : function(req,res,next) {
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
