const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
//const IndicatorModels = require('../../entity/indicator')
//const Tag = require('../../entity/tag').Entity
const logger = require('../../lib/logger')('eye:controller:indicator:crud')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const eventDispatcher = require('./events_middleware')
const { ClientError, ServerError } = require('../../lib/error-handler')

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

  // public indicator
  server.get('/indicator/:indicator/secret/:secret',
    router.resolve.idToEntity({ param: 'indicator', required: true }),
    router.requireSecret('indicator'),
    (req, res, next) => {
      res.send(req.indicator)
      next()
    }
  )

  //server.get('/indicator/title/:title/secret/:secret',
  //  router.resolve.idToEntity({ param: 'indicator', required: true }),
  //  findByTitleMiddleware(),
  //  router.requireSecret('indicator'),
  //  (req, res, next) => {
  //    res.send(req.indicator)
  //    next()
  //  }
  //)

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
    eventDispatcher({ operation: Constants.CREATE }),
    createTags,
  )

  server.put('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.REPLACE }),
    createTags,
  )

  server.put('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware({ required: false }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.REPLACE }),
    createTags,
  )

  server.patch('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE }),
    createTags,
  )

  server.patch('/indicator/:indicator/state',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.changeState,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE, eventName: 'set_state' })
  )

  server.patch('/indicator/:indicator/value',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.changeValue,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE, eventName: 'set_state' })
  )

  const deleteIndicatorEvents = async (req, res) => {
    return App.Models
      .Event
      .IndicatorEvent
      .deleteMany({ emitter_id: req.indicator._id })
  }

  server.del('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.DELETE }),
    deleteIndicatorEvents
  )

  server.del('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.DELETE }),
    deleteIndicatorEvents
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
          res.sendError(err)
        } else {
          res.send(200, models)
        }
      })
  },
  /**
   * @method PUT
   */
  replace (req, res, next) {
    if (!req.indicator) {
      controller.create(req, res).then(next)
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
            res.send(400, err)
          } else {
            res.sendError(err)
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
  async create (req, res) {
    const body = req.body
    if (!body) {
      throw new ClientError('empty payload. JSON body is required')
    }

    if (!body.type) {
      throw new ClientError('type is required')
    }

    if (!body.title) {
      throw new ClientError('title is required')
    }

    if (!validTitle(body.title)) {
      throw new ClientError('title is invalid')
    }

    const exists = await App.Models.Indicator.Indicator.findOne({
      title: body.title,
      customer_id: req.customer._id
    })

    if (exists) {
      throw new ClientError('title in use')
    }

    const input = Object.assign({}, body, {
      customer: req.customer,
      customer_id: req.customer._id,
      customer_name: req.customer.name,
      user: req.user,
      user_id: req.user._id
    })

    const indicator = new App.Models.Indicator.Factory(input)
    await indicator.save()

    req.indicator = indicator
    res.send(200, indicator)
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
          res.send(400, err)
        } else {
          res.sendError(err)
        }
      } else {
        res.send(200, model)
        next()
      }
    })
  },
  remove (req, res, next) {
    const indicator = req.indicator

    indicator.remove(err => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(204)
        next()
      }
    })
  },
  async get (req, res) {
    res.send(200, req.indicator)
    return
  },
  async changeState (req, res) {
    try {
      const indicator = req.indicator
      const state = req.body
      indicator.state = (state === 'success') ? 'normal' : state
      await indicator.save()
      res.send(200, indicator)
    } catch (err) {
      if (err.name == 'ValidationError') {
        res.send(400, err.name)
      } else {
        res.sendError(err)
      }
    }
    return
  },
  async changeValue (req, res) {
    try {
      const indicator = req.indicator
      indicator.value = req.body
      await indicator.save()
      res.send(200, indicator)
    } catch (err) {
      if (err.name == 'ValidationError') {
        res.send(400, err.name)
      } else {
        res.sendError(err)
      }
    }
    return
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
        res.sendError(err)
      } else if (!indicator && options.required !== false) {
        res.send(404, 'indicator not found')
      } else {
        req.indicator = indicator
        next()
      }
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
