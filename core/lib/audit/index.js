var config = require('config');
var elastic = require('../elastic');

module.exports = {

  afterUpdate (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: 'update'
      });
    }
  },

  afterRemove (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: 'delete'
      });
    }
  },

  afterCreate (name, specs) {
    var key = config.elasticsearch.keys[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, key, {
        name: model[ specs.display ],
        customer_name: req.customer.name,
        user_client_id: req.user.client_id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: 'create'
      });
    }
  },

}
