
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')

module.exports = (App) => {
  const middleware = (name, topic, operation) => {
    return (req, res, next) => {
      const model = req[name]
      const { user, customer } = req
      broadcastStateChanges(topic, operation, customer, user, model)
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

  return {
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

}
