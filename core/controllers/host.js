
const restify = require('restify')
const config = require('config')
const App = require('../app')
const Constants = require('../constants')
const dbFilter = require('../lib/db-filter')
const Host = require("../entity/host").Entity
const HostService = require('../service/host')
const logger = require('../lib/logger')('controller:host')
const NotificationService = require('../service/notification')
const Resource = require('../entity/resource').Entity
const router = require('../router')
const TopicsConstants = require('../constants/topics')
const Fingerprint = require('../lib/fingerprint')
const { ClientError, ServerError } = require('../lib/error-handler')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
  ]

  server.get('/:customer/host',
    middlewares,
    router.requireCredential('viewer'),
    controller.fetch
  )

  server.get('/:customer/host/:host',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    controller.get
  )

  server.put('/:customer/host/:host/reconfigure',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    controller.reconfigure
  )

  server.post('/:customer/host/:hostname',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }), // only agents can create hosts
    controller.create
  )

  server.post('/host/:hostname',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }), // only agents can create hosts
    controller.create
  )

  //
  // new agents registration process.
  //
  server.post('/host',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }), // only agents can create hosts
    restify.plugins.conditionalHandler([
      { version: '1.2.4', handler: controller.register }
    ])
  )

  server.put('/host/:host/disable',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    async (req, res, next) => {
      try {
        const host = req.host
        host.disabled = true
        await host.save()
        res.send(200, 'ok')
      } catch (err) {
        res.sendError(err)
      }
    }
  )
 
  server.put('/host/:host/enable',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    async (req, res, next) => {
      try {
        const host = req.host
        host.disabled = false
        await host.save()
        res.send(200, 'ok')
      } catch (err) {
        res.sendError(err)
      }
    }
  )

  server.put('/host/:host/fingerprints',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'host', required: true }),
    async (req, res, next) => {
      try {
        const host = req.host
        let fingerprints = req.body
        if (!Array.isArray(fingerprints)) {
          fingerprints = []
        }

        host.fingerprints = fingerprints
        await host.save()
        res.send(200, 'ok')
      } catch (err) {
        res.sendError(err)
      }
    }
  )
}

const controller = {
  async reconfigure (req, res, next) {
    try {
      const host = req.host
      const job = await App.jobDispatcher.createAgentUpdateJob(host._id)
      res.send(204)
      next()
    } catch (err) {
      logger.error(err)
      res.send(500, 'Internal Server Error')
    }
  },
  /**
   *
   *
   */
  get (req,res,next) {
    res.send(200, req.host.toObject())
  },
  /**
   *
   *
   */
  fetch (req,res,next) {
    const customer = req.customer
    const query = req.query // query string

    var filter = dbFilter(query.filter||{},{ /** default filters here **/})
    filter.where.customer_id = customer._id.toString()

    Host.fetchBy(filter, function (err,hosts) {
      if (err) {
        logger.error(err)
        return res.send(500, err)
      }

      if (!hosts||hosts.length===0) {
        res.send(200, [])
        return next()
      }

      HostService.populate(hosts, () => {
        res.send(200, hosts||[])
        next()
      })
    })
  },
  async register (req, res, next) {
    try {
      const { user, customer, body } = req
      const hostname = (req.params.hostname || req.body.hostname)
      const data = await registerPullAgent({ user, customer, hostname, info: body.info })

      const payload = Object.assign({}, config.agent.core_workers.host_ping)
      payload.host_id = data.host._id
      payload.resource_id = data.resource._id
      payload.connection_id = data.connection.fingerprint

      res.send(200, payload)
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   *
   *
   */
  create (req, res, next) {
    const hostname = req.params.hostname
    if (!hostname) {
      return res.send(400,'hostname required')
    }

    logger.log('processing hostname "%s" registration request', hostname)

    registerAgent(req, (error, result) => {
      if (error) {
        logger.error(error)
        return res.send()
      }

      var host = result.host
      var resource = result.resource

      logger.error('host "%s" registration completed.', hostname)

      const response = Object.assign(
        {
          resource_id: resource ? resource._id : null,
          host_id: host._id
        },
        config.agent.core_workers.host_ping
      )

      res.send(200, response)
      next()
    })
  }
}

/**
 * register a hostname.
 *
 * @author Facundo
 * @param {Object} req
 * @property {Object} req.customer
 * @property {String} req.params.hostname
 * @property {Object} req.body.info hostname information
 * @param {Function} done callback
 * @return null
 */
const registerAgent = (req, done) => {
  const customer = req.customer
  const hostname = (req.params.hostname || req.body.hostname)
  const body = req.body

  // setting up registration properties
  const properties = body.info || {}
  properties.agent_version = body.version || null

  Host.findOne({
    hostname,
    customer_name: customer.name
  }, (error, host) => {
    if (error) {
      return done(error)
    }

    if (!host) {
      logger.log("hostname '%s' not found.", hostname)

      return HostService.register({
        user: req.user,
        hostname,
        customer,
        info: properties
      }, (err, result) => {
        if (err) { return done(err) }

        const host = result.host
        NotificationService.generateSystemNotification({
          topic: TopicsConstants.host.registered,
          data: {
            model_type:'Host',
            model: host,
            model_id: host._id,
            hostname,
            organization: customer.name,
            organization_id: customer._id,
            operations: Constants.CREATE
          }
        })

        HostService.provisioning({
          host,
          resource: result.resource,
          customer,
          user: req.user
        }).then(() => {
          done(null, result)
        }).catch(done)
      })
    } else {
      logger.log('host found')

      if (host.disabled === true) {
        var error = new Error('host is disabled')
        error.statusCode = 400
        return done(error)
      }

      Resource.findOne({
        host_id: host._id,
        type: 'host'
      }, function(err,resource){
        if (error) {
          logger.error(err)
          return done(err)
        }
        if (!resource) {
          logger.error('resource for registered host "%s" not found', host._id)
          var err = new Error('host resource not found')
          err.statusCode = 500
          return done(err, { host: host })
        }

        return done(null, { host: host, resource: resource })
      })
    }
  })
}

const registerPullAgent = async (input) => {
  const { user, customer, info, hostname } = input

  let resource
  let host = await Host.findOne({
    hostname,
    customer_name: customer.name
  })

  if (!host) {
    const result = await new Promise((resolve, reject) => {
      HostService.register({
        user,
        hostname,
        customer,
        info
      }, (err, result) => {
        if (err) { reject(err) }
        else { resolve(result) }
      })
    })

    resource = result.resource
    host = result.host

    NotificationService.generateSystemNotification({
      topic: TopicsConstants.host.registered,
      data: {
        model_type:'Host',
        model: host,
        model_id: host._id,
        hostname,
        organization: customer.name,
        organization_id: customer._id,
        operations: Constants.CREATE
      }
    })

    await HostService.provisioning({
      host,
      resource,
      customer,
      user
    })
  } else {
    resource = await Resource.findOne({
      host_id: host._id,
      type: 'host'
    })

    if (!resource) {
      throw new ServerError('Host resource not found')
    }
  }

  const connection = await registerHostFingerprint(host, info)

  return { host, resource, connection }
}

const registerHostFingerprint = async (host, info) => {
  const calc = Fingerprint.machineUUID(App.namespace, info)

  const registered = host.fingerprints.find(fp => {
    return fp.fingerprint === calc
  })

  if (registered !== undefined) {
    return registered
  }

  const fingerprint = Object.assign({}, info, {
    fingerprint: calc,
    creation_date: new Date()
  })

  host.fingerprints.push(fingerprint)
  await host.save()

  return fingerprint
}
