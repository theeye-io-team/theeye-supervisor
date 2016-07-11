var json = require('../lib/jsonresponse');

module.exports = function(server, passport) {
  server.get('/:customer/resource/type', [
    passport.authenticate('bearer', {session:false}),
  ], controller.fetch);
};

var controller = {};
controller.fetch = function(req,res,next) {
	var types = [
		{id:1,name:'process'},
		{id:2,name:'host'},
		{id:3,name:'service'}
	];
	res.send(200, {'types':types});
}
