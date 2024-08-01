
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

    let events = await App.Models.Event.IndicatorEvent.find({
      enable: true,
      $or: [
        { emitter_id: indicator._id },
        { emitter_prop: 'tags', emitter_value: { $in: indicator.tags } },
        { emitter_prop: 'type', emitter_value: indicator.type },
        { emitter_prop: '_type', emitter_value: indicator._type },
        { emitter_prop: 'name', emitter_value: indicator.name },
        { emitter_prop: 'title', emitter_value: indicator.title },
      ],
      name: {
        $in: [ eventName, 'ALL' ] // eventName: created, changed, deleted or "ALL"
      }
    })

    if (!events || events.length === 0) {
      events = [
        await App.Models.Event.IndicatorEvent.create({
          customer: req.customer._id,
          emitter: indicator._id,
          emitter_id: indicator._id,
          name: eventName,
          creation_date: new Date(),
          last_update: new Date()
        })
      ]
    }

    for (const event of events) {
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
    }

    return
  }
}
