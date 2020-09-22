'use strict'

const App = require('../../app')
const Constants = require('../../constants')
const TopicsConstants = require('../../constants/topics')
const NotificationService = require('../../service/notification')

module.exports = {
  afterUpdate (name, specs) {
    const topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      const model = req[name]
      App.logger.submit(req.customer.name, topic, { // topic = topics[name].crud , UPDATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user.id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.UPDATE
      })


      next()
    }
  },

  afterReplace (name, specs) {
    const topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      const model = req[name]
      App.logger.submit(req.customer.name, topic, { // topic = topics[name].crud , REPLACE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user.id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.REPLACE
      })


      next()
    }
  },

  afterRemove (name, specs) {
    var topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      var model = req[name]
      App.logger.submit(req.customer.name, topic, { // topic = topics[name].crud , DELETE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user.id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.DELETE
      })


      next()
    }
  },

  afterCreate (name, specs) {
    var topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      var model = req[name]
      App.logger.submit(req.customer.name, topic, { // topic = topics[name].crud , CREATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user.id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.CREATE
      })


      next()
    }
  },
}
