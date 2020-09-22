const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const logger = require('../../lib/logger')('eye:controller:indicator:counter')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')

module.exports = function (server) {
  var middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.patch(
    '/indicator/:indicator/increase',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.increase,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )

  server.patch(
    '/indicator/:indicator/decrease',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.decrease,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )

  server.patch(
    '/indicator/:indicator/restart',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.restart,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )
}

const controller = {
  increase (req, res, next) {
    const indicator = req.indicator
    indicator.value++
    indicator.save(err => {
      if (err) { return res.send(500, err) }
      res.send(200)
      next()
    })
  },
  decrease (req, res, next) {
    const indicator = req.indicator
    if (indicator.value <= 0) {
      return res.send(200)
    }

    indicator.value--
    indicator.save(err => {
      if (err) { return res.send(500, err) }
      res.send(200)
      next()
    })
  },
  restart (req, res, next) {
    const indicator = req.indicator
    indicator.value = 0
    indicator.save(err => {
      if (err) { return res.send(500, err) }
      res.send(200)
      next()
    })
  }
}

const notifyEvent = (options) => {
  let operation = options.operation

  return function (req, res, next) {
    const indicator = req.indicator

    App.notifications.generateSystemNotification({
      topic: TopicsConstants.indicator.crud,
      data: {
        operation,
        organization: req.customer.name,
        organization_id: req.customer._id,
        model_id: indicator._id,
        model_type: indicator._type,
        model: indicator
      }
    })

    if (next) { return next() }
  }
}

const isNumericIndicator = (req, res, next) => {
  const indicator = req.indicator
  if (typeof indicator.value !== 'number') {
    return res.send(400, 'indicator type must be numeric')
  }
  next()
}
