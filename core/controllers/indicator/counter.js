const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const logger = require('../../lib/logger')('eye:controller:indicator:counter')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const eventDispatcher = require('./events_middleware')

module.exports = function (server) {

  server.patch('/indicator/:indicator/increase',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.increase,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )

  server.patch('/indicator/title/:title/increase',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    findByTitleMiddleware(),
    isNumericIndicator,
    controller.increase,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )

  server.patch('/indicator/:indicator/decrease',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.decrease,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )

  server.patch('/indicator/title/:title/decrease',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    findByTitleMiddleware(),
    isNumericIndicator,
    controller.decrease,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )

  server.patch('/indicator/:indicator/restart',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    isNumericIndicator,
    controller.restart,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )

  server.patch('/indicator/title/:title/restart',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('agent'),
    findByTitleMiddleware(),
    isNumericIndicator,
    controller.restart,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE })
  )
}

const findByTitleMiddleware = (options = {}) => {
  return (req, res, next) => {
    const title = req.params.title
    const customer = req.customer

    App.Models.Indicator.Indicator.findOne({
      title,
      customer_id: customer._id
    }, (err, indicator) => {
      if (err) {
        logger.error(err)
        return res.send(500, err.message)
      }

      if (!indicator && options.required !== false) {
        return res.send(404, 'indicator not found')
      }

      req.indicator = indicator
      return next()
    })
  }
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

const isNumericIndicator = (req, res, next) => {
  const indicator = req.indicator
  if (typeof indicator.value !== 'number') {
    return res.send(400, 'indicator type must be numeric')
  }
  next()
}
