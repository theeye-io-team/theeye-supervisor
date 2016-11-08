"use strict";

var debug = require('debug')('controller:host');
var config = require('config');
var _ = require('underscore');
var json = require("../lib/jsonresponse");
var Host = require("../entity/host").Entity;
var Resource = require('../entity/resource').Entity;
var HostService = require('../service/host');
var router = require('../router');
var NotificationService = require('../service/notification');
var elastic = require('../lib/elastic');

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ];

  /**
   * NEW ROUTES WITH CUSTOMER , TO KEEP IT GENERIC
   */
  server.post(
    '/:customer/host/:hostname',
    middlewares.concat(
      router.requireCredential('agent',{exactMatch:true}) // only agents can create hosts
    ),
    controller.create
  );
  server.get('/:customer/host',middlewares,controller.fetch);
  server.get('/:customer/host/:host',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'host',
        required: true
      })
    ),
    controller.get
  );

  /**
   * KEEP OLD ROUTE FOR BACKWARD COMPATIBILITY WITH OLD AGENTS
   *
   * AGENTS VERSION <= v0.9.1
   */
  var oldMiddlewares = middlewares.concat(router.logOldClientRequest);
  server.post(
    '/host/:hostname',
    oldMiddlewares.concat(
      router.requireCredential('agent',{exactMatch:true}) // only agents can create hosts
    ),
    controller.create
  );
}

var controller = {
  get (req,res,next) {
    var host = req.host;
    res.send(200, { host: host.toObject() });
  },
  /**
   *
   *
   */
  fetch (req,res,next) {
    var customer = req.customer;
    HostService.fetchBy({
      customer_name: customer.name
    }, (error,hosts) => {
      if(error) res.send(500);
      else res.send(200,{ hosts: hosts });
    });
  }
  /**
   *
   *
   */
  create (req, res, next) {
    var customer = req.customer;
    var hostname = req.params.hostname;
    if (!hostname) {
      return res.send(400,'hostname required');
    }
    debug('processing hostname "%s" registration request', hostname);

    var input = req.params.info||{};
    input.agent_version = req.params.version||null;

    registerHostname({
      'user': req.user,
      'customer': customer,
      'hostname': hostname,
      'host_properties': input
    }, function (error,result) {
      if(error) debug(error);

      var host = result.host;
      var resource = result.resource;

      debug('host "%s" registration completed.', hostname);

      var response = _.extend({
        resource_id: resource?resource._id:null,
        host_id: host._id
      },config.get("agent.core_workers.host_ping"));

      res.send(200, response); 
      next();
    });
  },
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
 * @param {Function} doneFn callback
 * @return null
 *
 */
function registerHostname (input, doneFn) {
  var customer = input.customer;
  var hostname = input.hostname;
  var properties = input.host_properties;

  Host.findOne({
    hostname: hostname,
    customer_name: customer.name
  },function(error,host){
    if(error) return doneFn(error);

    if(!host){
      debug("hostname '%s' not found.", hostname);
      return HostService.register({
        'user':input.user,
        'hostname':hostname,
        'customer':customer,
        'info':properties,
      },function(err,res){
        if(err) return doneFn(err);
        doneFn(err,res);
        var host = res.host;

        NotificationService.sendSNSNotification({
          'resource': 'host',
          'event': 'host_registered',
          'customer_name': host.customer_name,
          'hostname': host.hostname
        },{
          topic: 'events',
          subject: 'host_registered'
        });
      });
    } else {
      debug('host found');
      if(!host.enable) {
        var error = new Error('host is disabled');
        error.statusCode = 400;
        return doneFn(error);
      }

      /** update agent reported version **/
      function updateAgentVersion () {
        debug('updating agent version');
        host.agent_version = properties.agent_version;
        host.last_update = new Date();
        host.save();
        var data = {
          'customer_name': customer.name,
          'hostname': host.hostname,
          'version': host.agent_version
        };

        var key = config.elasticsearch.keys.agent.version;
        elastic.submit(customer.name,key,data);
      }

      updateAgentVersion();

      Resource.findOne({
        'host_id':host._id,
        'type':'host'
      },function(error,resource){
        if(error) return doneFn(error);
        if(!resource) {
          debug('resource for registered host "%s" not found', host._id);
          var error = new Error('host resource not found');
          error.statusCode = 500;
          return doneFn(error,{'host':host});
        }

        return doneFn(null, {'host':host,'resource':resource});
      });
    }
  });
}
