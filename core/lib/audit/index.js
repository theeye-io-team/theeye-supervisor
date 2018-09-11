'use strict'

const elastic = require('../elastic')
const Constants = require('../../constants')
const TopicsConstants = require('../../constants/topics')
const NotificationService = require('../../service/notification')

module.exports = {
  afterUpdate (name, specs) {
    const topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      const model = req[name]
      elastic.submit(req.customer.name, topic, { // topic = topics[name].crud , UPDATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.UPDATE
      })

      //NotificationService.generateSystemNotification({
      //  topic: topic,
      //  data: {
      //    hostname: model.hostname,
      //    organization: model.customer_name,
      //    operation: Constants.UPDATE,
      //    model_type: model._type,
      //    model: model
      //  }
      //})

      next()
    }
  },

  afterReplace (name, specs) {
    const topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      const model = req[name]
      elastic.submit(req.customer.name, topic, { // topic = topics[name].crud , REPLACE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.REPLACE
      })

      //NotificationService.generateSystemNotification({
      //  topic: topic,
      //  data: {
      //    hostname: model.hostname,
      //    organization: model.customer_name,
      //    operation: Constants.REPLACE,
      //    model_type: model._type,
      //    model: model
      //  }
      //})

      next()
    }
  },

  afterRemove (name, specs) {
    var topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      var model = req[name]
      elastic.submit(req.customer.name, topic, { // topic = topics[name].crud , DELETE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.DELETE
      })

      //NotificationService.generateSystemNotification({
      //  topic: topic,
      //  data: {
      //    hostname: model.hostname,
      //    organization: model.customer_name,
      //    operation: Constants.DELETE,
      //    model_type: model._type,
      //    model: model
      //  }
      //})

      next()
    }
  },

  afterCreate (name, specs) {
    var topic = specs.topic || TopicsConstants[name].crud
    return function (req, res, next) {
      var model = req[name]
      elastic.submit(req.customer.name, topic, { // topic = topics[name].crud , CREATE
        hostname: model.hostname || 'undefined',
        model_id: model._id,
        model_name: model[ specs.display ],
        model_type: model._type || 'undefined',
        organization: req.customer.name,
        user_id: req.user._id,
        user_name: req.user.username,
        user_email: req.user.email,
        operation: Constants.CREATE
      })

      //NotificationService.generateSystemNotification({
      //  topic: topic,
      //  data: {
      //    hostname: model.hostname,
      //    organization: model.customer_name,
      //    operation: Constants.CREATE,
      //    model_type: model._type,
      //    model: model
      //  }
      //})

      next()
    }
  },
}
