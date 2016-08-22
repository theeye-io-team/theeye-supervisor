"use strict";

var Tag = require('../entity/tag').Entity;
var resolver = require('../router/param-resolver');

module.exports = function(server, passport){
  server.get('/:customer/tag',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false})
  ], controller.get);
}

var controller = {
  get (req, res, next) {
    var customer = req.customer;
    if(!customer) res.send(400,'invalid customer %s', req.param.customer);
    Tag.find({ customer: customer }, function(error,tags){
      res.send(200,tags);
    });
  }
}
