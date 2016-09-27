"use strict";

var router = require('../router');
var resolve = router.resolve;
var debug = require('debug')('eye:controller:webhook');
var dbFilter = require('../lib/db-filter');

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session:false }),
    router.userCustomer,
    resolve.customerNameToEntity({ required:true }),
  ];

  server.get('/:customer/webhook',middlewares,controller.fetch);
  server.post('/:customer/webhook',middlewares,controller.create);

  server.get(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.get
  );

  server.put(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.update
  );

  server.del(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.remove
  );
}

var controller = {
  fetch (req, res, next) {
    var input = req.body;
  },
  create (req, res, next) {
    var input = req.body;
  },
  get (req, res, next) {
    var webhook = req.webhook;
  },
  update (req, res, next) {
    var webhook = req.webhook;
  },
  remove (req, res, next) {
    var webhook = req.webhook;
  },
}
