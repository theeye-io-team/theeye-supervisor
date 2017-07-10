'use strict'

const logger = require('../lib/logger')('controller:host');
//const debug = require('debug')('controller:host')
const config = require('config')
const lodash = require('lodash')
const elastic = require('../lib/elastic');
const router = require('../router');
const Host = require("../entity/host").Entity;
const Resource = require('../entity/resource').Entity;
const HostService = require('../service/host');
const NotificationService = require('../service/notification');
const dbFilter = require('../lib/db-filter');

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ]

  /**
   * NEW ROUTES WITH CUSTOMER , TO KEEP IT GENERIC
   */
  server.post('/:customer/host/:hostname',
    middlewares.concat(
      router.requireCredential('agent',{exactMatch:true}) // only agents can create hosts
    ),
    controller.create
  )

  server.get('/:customer/host',middlewares,controller.fetch)

  server.get('/:customer/host/:host',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'host',
        required: true
      })
    ),
    controller.get
  )

  server.get('/:customer/host/:host/config',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'host',
        required: true
      })
    ),
    controller.config
  )

  /**
   * KEEP OLD ROUTE FOR BACKWARD COMPATIBILITY WITH OLDER AGENTS
   *
   * AGENTS VERSION <= v0.9.1
   */
  server.post('/host/:hostname',
    middlewares.concat(
      router.requireCredential('agent',{exactMatch:true}) // only agents can create hosts
    ),
    controller.create
  )
}

const controller = {
  /**
   *
   *
   */
  get (req,res,next) {
    var host = req.host;
    res.send(200, host.toObject());
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
      res.send(200, hosts || [])
      next()
    })
  },
  /**
   *
   *
   */
  create (req, res, next) {
    var hostname = req.params.hostname;

    if (!hostname) {
      return res.send(400,'hostname required');
    }

    logger.log('processing hostname "%s" registration request', hostname);

    var input = req.params.info || {}
    input.agent_version = req.params.version || null

    registerHostname({
      user: req.user,
      customer: req.customer,
      hostname: hostname,
      host_properties: input
    }, function (error,result) {
      if (error) logger.error(error)

      var host = result.host;
      var resource = result.resource;

      logger.error('host "%s" registration completed.', hostname);

      const response = lodash.assign({
        resource_id: resource ? resource._id : null,
        host_id: host._id
      }, config.get('agent.core_workers.host_ping'))

      res.send(200, response); 
      next();
    });
  },
  /**
   *
   *
   */
  config (req, res, next) {
    const customer = req.customer
    const host = req.host
    HostService.config(host, customer, (err, config) => {
      res.send(200,config)
    })
  }
}

/**
 *
 * register a hostname.
 *
 * @author Facundo
 * @param {Object} input
 *    @property {Object} customer
 *    @property {String} hostname
 *    @property {Object} host_properties
 * @param {Function} done callback
 * @return null
 *
 */
const registerHostname = (input, done) => {
  const customer = input.customer
  const hostname = input.hostname
  const properties = input.host_properties

  Host.findOne({
    hostname: hostname,
    customer_name: customer.name
  }, function (error,host) {
    if (error) return done(error);

    if (!host) {
      logger.log("hostname '%s' not found.", hostname);

      return HostService.register({
        user: input.user,
        hostname: hostname,
        customer: customer,
        info: properties
      }, function (err,res) {
        if (err) return done(err)
        done(err,res)

        const host = res.host

        NotificationService.sendSNSNotification({
          resource: 'host',
          event: 'host_registered',
          customer_name: host.customer_name,
          hostname: host.hostname
        },{
          topic: 'events',
          subject: 'host_registered'
        })
      })
    } else {
      logger.log('host found');

      if (!host.enable) {
        var error = new Error('host is disabled');
        error.statusCode = 400;
        return done(error);
      }

      /** update agent reported version **/
      function updateAgentVersion () {
        logger.log('updating agent version');
        host.agent_version = properties.agent_version;
        host.last_update = new Date();
        host.save();
        var data = {
          customer_name: customer.name,
          hostname: host.hostname,
          version: host.agent_version
        };

        var key = config.elasticsearch.keys.agent.version;
        elastic.submit(customer.name,key,data);
      }

      updateAgentVersion();

      Resource.findOne({
        host_id: host._id,
        type: 'host'
      },function(err,resource){
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
      });
    }
  })
}
