var json = require(process.env.BASE_PATH + "/lib/jsonresponse");
var StateHandler = require(process.env.BASE_PATH + '/service/resource-state-handler');
var debug = require('../lib/logger')('eye:supervisor:controller:event');

module.exports = function(server, passport){
	server.post('/event', [
    passport.authenticate('bearer', {session:false}),
  ], controller.create);

  return {
    routes: [
      {
        route: '/event',
        method: 'post',
        middleware: [ ],
        action: controller.create
      }
    ]
  }
}

var controller = {
	create : function (req, res, next) {
		var customer = req.params.customer ;
		var resource = req.params.resource ;
		var host = req.params.host ;
		var state_name = req.params.state_name ;
		var state_data = req.params.state_data ;

		if(!state_name || typeof state_name=='undefined' || state_name==''){
			res.send(400,json.error('resource state name is required'));
		} else {
			debug.log('handling new event');
			var handler = new StateHandler(resource,state_name);
			handler.handleState(function(){
				res.send(200);
			});
		}
	}
};
