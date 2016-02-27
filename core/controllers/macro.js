var paramsResolver = require('../router/param-resolver');
var paramsFilter = require('../router/param-filter');
var debug = require('debug')('eye:supervisor:controller:job');
var Job = require('../entity/job').Entity;

module.exports = function(server, passport){
  server.post('/macro/:script/run', [
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'script'}),
    paramsResolver.idToEntity({param:'host'}),
    paramsFilter.spawn({param:'script_arguments', filter:'toArray'})
  ], controller.run);
}

var controller = {
  /**
   * run a marco
   * @method POST
   * @param Script script id
   * @param Host host id
   * @param Array script arguments
   */
  run : function(req, res, next) {
    debug('processing "run macro" request');

    var script = req.script;
    var host = req.host;
    var user = req.user;
    var args = req.script_arguments;

    var errors = [];
    if(!script) errors.push({'param':'script','message':'required'});
    if(!host) errors.push({'param':'host','message':'required'});
    if(!user) errors.push({'param':'user','message':'required'});

    if(errors.length != 0) return res.send(400, {"errors":errors, "req":req.params});

    Job.createMacro({
      host: host,
      "script_id": script._id,
      "script_arguments": args,
      user: user,
      notify: true
    },function(job) {
      job.publish(function(pub){
        res.send(200,{ job : pub });
      });
    });
  }
}
