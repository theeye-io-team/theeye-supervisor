"use strict";

var Tag = require('../entity/tag').Entity;
var router = require('../router');

module.exports = function(server, passport){
  server.get('/:customer/tag',[
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ], controller.get);
}

var controller = {
  get (req, res, next) {
    var customer = req.customer;
    Tag.find({ customer: customer }, function(error,tags){
      res.send(200,tags);
    });
  }
}
