"use strict";

var Tag = require('../entity/tag').Entity;
var router = require('../router');

module.exports = function(server){
  server.get('/:customer/tag',[
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ], controller.get);
}

var controller = {
  get (req, res, next) {
    var customer = req.customer;
    Tag.find({ customer: customer._id }, function(error,tags){
      res.send(200,tags);
    });
  }
}
