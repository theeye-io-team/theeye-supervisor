const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
//const IndicatorModels = require('../../entity/indicator')
//const Tag = require('../../entity/tag').Entity
const logger = require('../../lib/logger')('eye:controller:indicator:crud')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const eventDispatcher = require('./events_middleware')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  /** 
  * @openapi
  * /indicator:
  *   summary: Get all indicators.
  *   description: Returns a list of all indicators.
  *   responses:
  *     '200':
  *       description: Successfully retrieved the list of indicators.
  *       content:
  *         application/json:
  *           schema:
  *             type: array
  *             items:
  *               $ref: '#/components/schemas/Indicator'
  *     '401':
  *       description: Authentication failed.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Indicator'
  *
  */
  server.get('/indicator',
    middlewares,
    router.ensurePermissions(),
    router.dbFilter(),
    controller.fetch
  )

  /** 
  * @openapi
  * /indicator/{indicator}:
  *   summary: Get one Indicator
  *   description: Get only one indicator.
  *   parameters:
  *     - name: indicator
  *       in: query
  *       description: Indicator title
  *       required: true
  *       schema:
  *         type: string
  *   responses:
  *     '200':
  *       description: Successfully retrieved the indicator.
  *       content:
  *         application/json:
  *           schema:
  *             type: array
  *             items:
  *               $ref: '#/components/schemas/Indicator'
  *     '401':
  *       description: Authentication failed.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Error'
  *
  */

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

  /** 
   * @openapi
   * /indicator/title/{title}:
   *   summary: Get one Indicator by title
   *   description: Get only one indicator.
   *   parameters:
   *     - name: title
   *       in: query
   *       description: Indicator title
   *       schema:
   *         type: string
   *   responses:
   *     '200':
   *       description: Successfully retrieved the indicator.
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               $ref: '#/components/schemas/Indicator'
   *     '401':
   *       description: Authentication failed.
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Error'
   *
=======
  /** 
  * @openapi
  * /indicator/title/{title}:
  *   summary: Get one Indicator by title
  *   description: Get only one indicator.
  *   parameters:
  *     - name: title
  *       in: query
  *       description: Indicator title
  *       required: true
  *       schema:
  *         type: string
  *   responses:
  *     '200':
  *       description: Successfully retrieved the indicator.
  *       content:
  *         application/json:
  *           schema:
  *             type: array
  *             items:
  *               $ref: '#/components/schemas/Indicator'
  *     '401':
  *       description: Authentication failed.
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Error'
  *
  */
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

  /** 
  * @openapi
  * /indicator:
  *   post:
  *     summary: Create a new indicator.
  *     description: Creates a new indicator and returns the indicator ID.
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/IndicatorCreate'
  *     responses:
  *       '201':
  *         description: Successfully created a new indicator.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Indicator'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post('/indicator',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.CREATE }),
    createTags,
  )

  /** 
   * @openapi
  * @openapi
  * /indicator/{indicatorId}:
  *   put:
  *     summary: Update an existing Indicator by Id
  *     tags:
  *       - Indicators
  *     description: Change an Indicator.
  *     parameters:
  *       - name: indicatorId
  *         in: query
  *         description: Indicator Id
  *         required: true
  *         schema:
  *           type: string
  *           example: 633ae702877ba623cd2626df
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Indicator'
  *     responses:
  *       '201':
  *         description: Successfully updated an indicator.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Indicator'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
  server.put('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.REPLACE }),
    createTags,
  )

  /** 
  * @openapi
  * /indicator/title/{title}:
  *   put:
  *     summary: Update an existing Indicator by title
  *     description: Change an Indicator
  *     tags:
  *       - Indicators
  *     parameters:
  *       - name: title
  *         in: query
  *         description: Indicator Id
  *         required: true
  *         schema:
  *           type: string
  *           example: 633ae702877ba623cd2626df
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Indicator'
  *     responses:
  *       '201':
  *         description: Successfully updated an indicator.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Indicator'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
  server.put('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware({ required: false }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.REPLACE }),
    createTags,
  )

  /** 
  * @openapi
  * /indicator/title/{title}:
  *   patch:
  *     summary: Update an existing Indicator by title
  *     description: Change an Indicator
  *     tags:
  *       - Indicators
  *     parameters:
  *       - name: title
  *         in: query
  *         description: Indicator Id
  *         required: true
  *         schema:
  *           type: string
  *           example: 633ae702877ba623cd2626df
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Indicator'
  *     responses:
  *       '201':
  *         description: Successfully updated an indicator.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Indicator'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
  server.patch('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE }),
    createTags,
  )

  /** 
   * @openapi
   * /indicator/{indicatorId}:
   *   patch:
   *     summary: Update an existing Indicator by Id
   *     description: Change an Indicator
   *     tags:
   *       - Indicators
   *     parameters:
   *       - name: indicatorId
   *         in: query
   *         description: Indicator Id
   *         required: true
   *         schema:
   *           type: string
   *           example: 633ae702877ba623cd2626df
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Indicator'
   *     responses:
   *       '201':
   *         description: Successfully updated an indicator.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Indicator'
   *       '400':
   *         description: Invalid request data.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       '401':
   *         description: Authentication failed.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *
   */
  server.patch('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.UPDATE }),
    createTags,
  )

  /** 
  * @openapi
  * /indicator/{indicatorId}/state:
  *   patch:
  *     summary: Update an existing Indicator's state
  *     description: Change an Indicator
  *     tags:
  *       - Indicators
  *     parameters:
  *       - name: indicatorId
  *         in: query
  *         description: Indicator Id
  *         required: true
  *         schema:
  *           type: string
  *           example: 633ae702877ba623cd2626df
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Indicator'
  *     responses:
  *       '201':
  *         description: Successfully updated an indicator.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Indicator'
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
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

  /** 
  * @openapi
  * /indicator/{indicatorId}:
  *   delete:
  *     summary: Delete one Indicator
  *     tags:
  *       - Indicators
  *     description: Delete only one indicator.
  *     parameters:
  *       - name: indicatorId
  *         in: query
  *         description: Specific Indicator Id
  *         required: true
  *         schema:
  *           type: string
  *           example: 6329f36078a97174fd4ae7c6
  *     responses:
  *       204:
  *         description: Successfully deleted an indicator.
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */
  server.del('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    eventDispatcher({ operation: Constants.DELETE }),
    deleteIndicatorEvents
  )

  /** 
  * @openapi
  * /indicator/title/{title}:
  *   delete:
  *     summary: Delete one Indicator
  *     tags:
  *       - Indicators
  *     description: Delete only one indicator.
  *     parameters:
  *       - name: title
  *         in: query
  *         description: Indicator Title
  *         required: true
  *         schema:
  *           type: string
  *           example: 6329f36078a97174fd4ae7c6
  *     responses:
  *       204:
  *         description: Successfully deleted an indicator.
  *       '400':
  *         description: Invalid request data.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

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
          return res.send(400, err)
        } else {
          res.sendError(err)
        }
      } else {
        res.send(200, model)
        req.indicator = indicator
        next()
      }
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
          res.send(400, err)
        } else {
          res.sendError(500)
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
  get (req, res, next) {
    res.send(200, req.indicator)
    next()
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
