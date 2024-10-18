
const logger = require('../lib/logger')(':app:state')
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')
const ErrorHandler = require('../lib/error-handler')

module.exports = (App) => {

  const handlers = {
    postUpdate (name) {
      const topic = TopicsConstants[name].crud
      const operation = Constants.UPDATE
      return middleware(name, topic, operation)
    },
    postReplace (name) {
      const topic = TopicsConstants[name].crud
      const operation = Constants.REPLACE
      return middleware(name, topic, operation)
    },
    postRemove (name) {
      const topic = TopicsConstants[name].crud
      const operation = Constants.DELETE
        return middleware(name, topic, operation)
    },
    postCreate (name) {
      const topic = TopicsConstants[name].crud
      const operation = Constants.CREATE
      return middleware(name, topic, operation)
    }
  }

  const middleware = (name, topic, operation) => {
    return (req, res, next) => {
      try {
        const model = req[name]
        if (!model) {
          throw new ErrorHandler.ServerError(`req[${name}] is not defined. cannot broadcast state change`)
        }
        const { user, customer } = req
        broadcastStateChanges(topic, operation, customer, user, model)
      } catch (err) {
        logger.error(err)
        const errorHandler = new ErrorHandler()
        errorHandler.sendExceptionAlert(err, req)
      }
      // continue with the next middleware anyway
      next()
    }
  }

  const broadcastStateChanges = (topic, operation, customer, user, model) => {
    const data = {
      model,
      model_id: model._id,
      model_type: model._type,
      organization: customer.name,
      organization_id: customer._id,
      user_id: user.id,
      user_name: user.username,
      user_email: user.email,
      operation
    }

    // incremental state updates
    App.logger.submit(customer.name, topic, data)

    // update notifications api
    App.notifications.generateSystemNotification({ topic, data })

    const engineEvent = new App.Models.Event.Event({
      emitter_id: model._id,
      name: `${topic}:${operation}`,
      creation_date: new Date(),
      last_update: new Date()
    })

    // internal event
    App.eventDispatcher.dispatch({ topic, event: engineEvent, model })
  }

  return handlers

}
