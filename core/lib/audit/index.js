'use strict'

const config = require('config')
const elastic = require('../elastic')
const CONSTANTS = require('../../constants')

module.exports = {
  afterUpdate (name, specs) {
    var topic = specs.topic || config.notifications.topics[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, topic, { // topic = config.notifications.topics[name].crud , UPDATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: CONSTANTS.UPDATE
      });
    }
  },

  afterReplace (name, specs) {
    var topic = specs.topic || config.notifications.topics[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, topic, { // topic = config.notifications.topics[name].crud , REPLACE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: CONSTANTS.REPLACE
      });
    }
  },

  afterRemove (name, specs) {
    var topic = specs.topic || config.notifications.topics[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, topic, { // topic = config.notifications.topics[name].crud , DELETE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: CONSTANTS.DELETE
      });
    }
  },

  afterCreate (name, specs) {
    var topic = specs.topic || config.notifications.topics[name].crud;
    return function (req, res, next) {
      var model = req[name];
      elastic.submit(req.customer.name, topic, { // topic = config.notifications.topics[name].crud , CREATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: CONSTANTS.CREATE
      });
    }
  },
}
