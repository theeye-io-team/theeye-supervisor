const App = require('../app')
const TopicsConstants = require('../constants/topics')
const Logger = require('../lib/logger')('router:middleware:notify')
//const NotificationService = require('../service/notification')

module.exports = (specs) => {
  return (req, res, next) => {
    const customer = req.customer
    const { operation, name } = specs
    const model = (specs.model || req[name]) // or take it from the req
    const topic = (specs.topic || TopicsConstants[name].crud)

    App.notifications
      .generateSystemNotification({
        topic,
        data: {
          operation,
          organization: customer.name,
          organization_id: customer._id,
          model,
          model_id: model?._id,
          model_type: model?._type,
        }
      })
      .then(response => { })
      .catch(err => {
        Logger.error(`Failed to submit system notification event. %o`, specs)
      })

    return next()
  }
}
