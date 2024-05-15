const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
//const IndicatorModels = require('../../entity/indicator')
//const Tag = require('../../entity/tag').Entity
const logger = require('../../lib/logger')('eye:controller:indicator:crud')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get('/indicator',
    middlewares,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  server.get('/indicator/:indicator',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.get
  )

  server.get('/indicator/title/:title',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    findByTitleMiddleware(),
    controller.get
  )

  const createTags = (req, res, next) => {
    const customer = req.customer
    const indicator = req.indicator

    let tags = indicator.tags
    if (tags && Array.isArray(tags) && tags.length > 0) {
      App.Models.Tag.Tag.create(tags, customer)
    }
  }

  server.post('/indicator',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.CREATE }),
    createTags,
  )

  server.put('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  server.put('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware({ required: false }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  server.patch('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch('/indicator/:indicator/state',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.updateState,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )

  server.del('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.DELETE })
  )

  server.del('/indicator/title/:title',
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
    const filter = req.dbQuery

    App.Models.Indicator.Indicator
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
      const body = req.body
      if (!body) {
        return res.send(400, 'empty payload. JSON body is required')
      }

      // replace current
      if (
        body.hasOwnProperty('title') &&
        !validTitle(body.title)
      ) {
        return res.send(400, 'invalid title')
      }

      const indicator = req.indicator
      let values = Object.assign({}, indicatorResetValues(indicator), body)
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
    const body = req.body
    if (!body) {
      return res.send(400, 'empty payload. JSON body is required')
    }

    if (!body.type) {
      return res.send(400, 'type is required')
    }

    if (!body.title) {
      return res.send(400, 'title is required')
    }

    if (!validTitle(body.title)) {
      return res.send(400, 'title is invalid')
    }

    const input = Object.assign({}, body, {
      customer: req.customer,
      customer_id: req.customer._id,
      customer_name: req.customer.name,
      user: req.user,
      user_id: req.user._id
    })

    const indicator = new App.Models.Indicator.Factory(input)
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
    const body = req.body

    if (!body) {
      return res.send(400, 'empty payload. JSON body is required')
    }

    if (
      body.hasOwnProperty('title') &&
      !validTitle(body.title)
    ) {
      return res.send(400, 'invalid title')
    }

    indicator.set(body)
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
  async updateState (req, res) {
    try {
      const indicator = req.indicator
      const body = req.body

      if (!body || (!body.state && !body.value)) {
        return res.send(400, 'provide the state changes. value and/or state are required')
      }

      let state = body.state
      if (state === 'success') { state = 'normal' }
      if (body.state) { indicator.state = state }
      if (body.value) { indicator.value = body.value }

      await indicator.save()

      res.send(200, indicator)
    } catch (err) {
      if (err.name == 'ValidationError') {
        res.send(400, err.name)
      } else {
        res.send(500, err)
      }
    }
    return
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

const mutableKeys = [
  'description','acl','severity',
  'alerts','state','sticky','read_only',
  'tags','value','name'
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
