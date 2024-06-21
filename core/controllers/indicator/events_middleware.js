
const App = require('../../app')

const Constants = require('../../constants')

const EventNamaByOperation = { }
EventNamaByOperation[ Constants.CREATE ] = 'created'
EventNamaByOperation[ Constants.REPLACE ] = 'changed'
EventNamaByOperation[ Constants.UPDATE ] = 'changed'
EventNamaByOperation[ Constants.DELETE ] = 'deleted'

const TopicsConstants = require('../../constants/topics')

module.exports = (options) => {
  let { operation, eventName } = options

  return async function (req, res) {
    const topic = TopicsConstants.indicator.crud
    const indicator = req.indicator

    App.notifications.generateSystemNotification({
      topic,
      data: {
        operation,
        organization: req.customer.name,
        organization_id: req.customer._id,
        model_id: indicator._id,
        model_type: indicator._type,
        model: indicator
      }
    })

    if (!eventName) {
      eventName = EventNamaByOperation[operation]
    }

    let event = await App.Models.Event.IndicatorEvent.findOne({
      emitter_id: indicator._id,
      enable: true,
      name: eventName
    })

    if (!event) {
      event = await App.Models.Event.IndicatorEvent.create({
        customer: req.customer._id,
        emitter: indicator._id,
        emitter_id: indicator._id,
        name: eventName,
        creation_date: new Date(),
        last_update: new Date()
      })
    }

    App.eventDispatcher.dispatch({
      topic,
      event,
      data: [{
        topic,
        event_name: eventName,
        operation,
        model_id: indicator._id,
        model_type: indicator._type,
      }],
      indicator
    })

    return
  }
}
