const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')
//const IndicatorModels = require('../../entity/indicator')
//const Tag = require('../../entity/tag').Entity
const logger = require('../../lib/logger')('eye:controller:indicator:crud')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')
const Acl = require('../../lib/acl')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]


  /** 
   * @openapi
   * /indicator:
   *  get:
   *    summary: Get all Indicators
   *    tags: 
   *      - Indicators
   *    description: Get all indicator from an organization.
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *
  */

  server.get('/indicator', middlewares, controller.fetch)

  /** 
   * @openapi
   * /indicator/{indicatorId}:
   *  get:
   *    summary: Get one Indicator
   *    tags: 
   *      - Indicators
   *    description: Get only one indicator.
   *    parameters:
   *      - name: Id
   *        in: query
   *        description: Specific Indicator Id
   *        required: true
   *        schema:
   *          type: string
   *          example: 6329f36078a97174fd4ae7c6
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.get('/indicator/:indicator',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.get
  )

  /** 
   * @openapi
   * /indicator/title/{title}:
   *  get:
   *    summary: Get Indicator by title
   *    tags: 
   *      - Indicators
   *    description: Get one indicator by it's title.
   *    parameters:
   *      - name: Title
   *        in: query
   *        description: Indicator title
   *        required: true
   *        schema:
   *          type: string
   *          example: MikeTheIndicator
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid title value
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
   *  post:
   *    summary: Create an Indicator
   *    tags: 
   *      - Indicators
   *    description: Create an idicator.
   *    parameters:
   *      - in: body
   *        name: Parameters
   *        description: Indicator values
   *        required: true
   *        schema:
   *          type: object
   *          requiered: 
   *            - userName
   *          properties:
   *            type:
   *              type: string
   *            name: 
   *              type:   string
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *
  */

  server.post('/indicator',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.CREATE }),
    createTags,
  )

/** 
   * @openapi
   * /indicator/{indicatorId}:
   *  put:
   *    summary: Update an existing Indicator by Id
   *    tags: 
   *      - Indicators
   *    description: Change an Indicator.
   *    parameters:
   *      - name: Indicator Id
   *        in: query
   *        description: Indicator Id
   *        required: true
   *        schema:
   *          type: string
   *          example: 633ae702877ba623cd2626df
   *    requestBody:
   *      description: Optional description in *Markdown*
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: "#definitions/indicator/components/schemas/Indicator"
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */
  server.put('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required:true }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  /** 
   * @openapi
   * /indicator/title/{title}:
   *  put:
   *    summary: Update an existing Indicator by title
   *    description: Change an Indicator
   *    tags: 
   *      - Indicators
   *    parameters:
   *      - name: Title
   *        in: query
   *        description: Indicator title
   *        required: true
   *        schema:
   *          type: string
   *          example: "indicator_1"
   *    requestBody:
   *      description: Optional description in *Markdown*
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: "#definitions/indicator/components/schemas/Indicator"
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.put('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware({ required: false }),
    controller.replace,
    audit.afterReplace('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.REPLACE }),
    createTags,
  )

  /** 
   * @openapi
   * /indicator/title/{title}:
   *  patch:
   *    summary: Update an existing Indicator by title
   *    description: Change an Indicator
   *    tags: 
   *      - Indicators
   *    parameters:
   *      - name: Title
   *        in: query
   *        description: Indicator title
   *        required: true
   *        schema:
   *          type: string
   *          example: "indicator_1"
   *    requestBody:
   *      description: Optional description in *Markdown*
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: "#definitions/indicator/components/schemas/Indicator"
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.patch('/indicator/title/:title',
    middlewares,
    router.requireCredential('admin'),
    findByTitleMiddleware(),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  /** 
   * @openapi
   * /indicator/{indicatorId}:
   *  patch:
   *    summary: Update an existing Indicator by Id
   *    description: Change an Indicator
   *    tags: 
   *      - Indicators
   *    parameters:
   *      - name: Id
   *        in: query
   *        description: Indicator Id
   *        required: true
   *        schema:
   *          type: string
   *          example: "6329f36078a97174fd4ae7c6"
   *    requestBody:
   *      description: Optional description in *Markdown*
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: "#definitions/indicator/components/schemas/Indicator"
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.patch('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.update,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE }),
    createTags,
  )

  /** 
   * @openapi
   * /indicator/{indicatorId}/state:
   *  patch:
   *    summary: Update an existing Indicator's state
   *    description: Change an Indicator
   *    tags: 
   *      - Indicators
   *    parameters:
   *      - name: Id
   *        in: query
   *        description: Indicator Id
   *        required: true
   *        schema:
   *          type: string
   *          example: "6329f36078a97174fd4ae7c6"
   *    requestBody:
   *      description: Optional description in *Markdown*
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: "#definitions/indicator/components/schemas/Indicator"
   *    responses: 
   *      200:
   *        description: OK.
   *        content:
   *          application/json:
   *            schema:
   *              $ref: "#definitions/indicator/components/schemas/Indicator"
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.patch('/indicator/:indicator/state',
    middlewares,
    router.requireCredential('agent'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.updateState,
    audit.afterUpdate('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.UPDATE })
  )

  /** 
   * @openapi
   * /indicator/{indicatorId}:
   *  delete:
   *    summary: Delete one Indicator
   *    tags: 
   *      - Indicators
   *    description: Delete only one indicator.
   *    parameters:
   *      - name: Id
   *        in: query
   *        description: Specific Indicator Id
   *        required: true
   *        schema:
   *          type: string
   *          example: 6329f36078a97174fd4ae7c6
   *    responses: 
   *      200:
   *        description: OK.
   *      400:
   *        description: Indicator invalid value
   *
  */

  server.del('/indicator/:indicator',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param:'indicator', required: true }),
    controller.remove,
    audit.afterRemove('indicator', { display: 'title' }),
    notifyEvent({ operation: Constants.DELETE })
  )

  /** 
   * @openapi
   * /indicator/title/{title}:
   *  delete:
   *    summary: Delete one Indicator
   *    tags: 
   *      - Indicators
   *    description: Delete only one indicator.
   *    parameters:
   *      - name: Title
   *        in: query
   *        description: Indicator Title
   *        required: true
   *        schema:
   *          type: string
   *          example: 6329f36078a97174fd4ae7c6
   *    responses: 
   *      200:
   *        description: OK.
   *      400:
   *        description: Indicator invalid value
   *
  */

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
    var filter = dbFilter(
      Object.assign({}, (req.query||{}) , {
        where: {
          customer: req.customer._id
        }
      })
    )

    if ( !Acl.hasAccessLevel(req.user.credential, 'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email
    }

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
  async updateState (req, res, next) {
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
      return next()
    } catch (err) {
      if (err.name == 'ValidationError') {
        return res.send(400, err.name)
      } else {
        return res.send(500, err)
      }
    }
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
