var config = require('config');
var elastic = require('../elastic');
const Constants = require('../../constants');

module.exports = {
  afterUpdate (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        id: model._id,
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.UPDATE
      });
    }
  },

  afterRemove (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        id: model._id,
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.DELETE
      });
    }
  },

  afterCreate (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        id: model._id,
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.CREATE
      });
    }
  },
}
