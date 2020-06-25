const extend = require('lodash/assign')
const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')
const IndicatorModels = require('../../entity/indicator')
const Tag = require('../../entity/tag').Entity
const logger = require('../../lib/logger')('eye:controller:indicator:crud')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const Acl = require('../../lib/acl')

module.exports = function (server) {
  var middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get('/indicator', middlewares, controller.fetch)

  server.get(
    '/indicator/:indicator',
    middlewares,
    router.resolve.idToEntity({ param:'indicator', required:true }),
    controller.get
  )

  server.get(
    '/indicator/title/:title',
    middlewares,
    findByTitleMiddleware(),
    controller.get
  )

  const createTags = (req, res, next) => {
    const customer = req.customer
    const indicator = req.indicator

    let tags = indicator.tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      Tag.create(tags, customer)
    }
  }

  server.post(
    '/indicator',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.CREATE }),
    createTags,
  )

  server.put(
    '/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'indicator' }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  server.put(
    '/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware({ required: false }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  server.patch(
    '/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch(
    '/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch(
    '/indicator/:indicator/state',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    controller.updateState,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )

  server.del(
    '/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'indicator', required: true }),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.DELETE })
  )

  server.del(
    '/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.DELETE })
  )
}

const controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    var filter = dbFilter(
      extend( (req.query||{}) , {
        where: {
          customer: req.customer._id
        }
      })
    )

    if ( !Acl.hasAccessLevel(req.user.credential, 'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

    IndicatorModels
      .Indicator
      .find(filter.where)
      .exec((err, models) => {
        if (err) {
          logger.error(err)
          return res.send(500)
        }
        res.send(200, models)
      })
  },
  /**
   * @method PUT
   */
  replace (req, res, next) {
    if (!req.indicator) {
      controller.create(req, res, next)
    } else {
      // replace current
      if (
        req.body.hasOwnProperty('title') &&
        !validTitle(req.body.title)
      ) {
        return res.send(400, 'invalid title')
      }

      const indicator = req.indicator
      let values = Object.assign({}, indicatorResetValues(indicator), req.body)
      indicator.set(values)
      indicator.save((err, model) => {
        if (err) {
          if (err.name == 'ValidationError') {
            logger.debug('%o', err)
            return res.send(400, err)
          } else {
            logger.error('%o', err)
            return res.send(500)
          }
        } else {
          res.send(200, values)
          return next()
        }
      })
    }
  },
  /**
   * @method POST
   */
  create (req, res, next) {
    if (!req.body.type) {
      return res.send(400, 'type is required')
    }

    if (!req.body.title) {
      return res.send(400, 'title is required')
    }

    if (!validTitle(req.body.title)) {
      return res.send(400, 'title is invalid')
    }

    const input = extend({}, req.body, {
      customer: req.customer,
      customer_id: req.customer._id,
      customer_name: req.customer.name,
      user: req.user,
      user_id: req.user._id
    })

    var indicator = new IndicatorModels.Factory(input)
    indicator.save((err, model) => {
      if (err) {
        if (err.name == 'ValidationError') {
          logger.debug('%o', err)
          return res.send(400, err)
        } else {
          logger.error('%o', err)
          return res.send(500)
        }
      }

      res.send(200, model)
      req.indicator = indicator
      next()
    })
  },
  /**
   * @method PATCH
   */
  update (req, res, next) {
    const indicator = req.indicator

    if (
      req.body.hasOwnProperty('title') &&
      !validTitle(req.body.title)
    ) {
      return res.send(400, 'invalid title')
    }

    indicator.set(req.body)
    indicator.save((err, model) => {
      if (err) {
        if (err.name == 'ValidationError') {
          logger.debug('%o', err)
          return res.send(400, err)
        } else {
          logger.error('%o', err)
          return res.send(500)
        }
      }

      res.send(200, model)
      return next()
    })
  },
  remove (req, res, next) {
    const indicator = req.indicator

    indicator.remove(err => {
      if (err) { return res.send(500,err) }
      res.send(204)
      next()
    })
  },
  get (req, res, next) {
    res.send(200, req.indicator)
    next()
  },
  updateState (req, res, next) {
    let indicator = req.indicator
    let body = req.body

    if (!body.state && !body.value) {
      return res.send(400, 'provide the state changes. value and/or state are required')
    }

    if (body.state) { indicator.state = body.state }
    if (body.value) { indicator.value = body.value }
    indicator.save(err => {
      if (err) {
        if (err.name == 'ValidationError') {
          return res.send(400, err.name)
        } else {
          return res.send(500, err)
        }
      }

      res.send(200)
      return next()
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
        model_type: indicator._type,
        model: indicator
      }
    })

    if (next) { return next() }
  }
}

const validTitle = (title) => {
  // boolean, null, 0, ''
  if (!title) { return false }
  if (typeof title !== 'string') { return false }
  return true

  //const regex = /\s+/
  //if (regex.test(title)===true) {
  //  return false
  //} else {
  //  return true
  //}
}

const findByTitleMiddleware = (options = {}) => {
  return (req, res, next) => {
    const title = req.params.title
    const customer = req.customer

    IndicatorModels.Indicator.findOne({
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

const mutableKeys = [
  'description','acl','severity',
  'alerts','state','sticky','read_only',
  'tags','value'
]

const indicatorResetValues = (indicator) => {
  let vo = indicator.toObject()
  for (let key in vo) {
    if (mutableKeys.indexOf(key) !== -1) {
      let path = indicator.schema.paths[key]
      if (path !== undefined) {
        if (typeof path.defaultValue === 'function') {
          vo[key] = path.defaultValue()
        } else {
          vo[key] = path.defaultValue
        }
      }
    }
  }
  return vo
}
