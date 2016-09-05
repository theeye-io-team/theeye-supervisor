var debug = require('../lib/logger')('eye:supervisor:controller:event');
var resolver = require('../router/param-resolver');

module.exports = function(server, passport){
	server.post('/:customer/event', [
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
  ], controller.create);
}

var controller = {
	create : function (req, res, next) {
	}
};
