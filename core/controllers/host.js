"use strict";

var json = require("../lib/jsonresponse");
var Host = require("../entity/host").Entity;
var Resource = require('../entity/resource').Entity;
var HostService = require('../service/host');
var debug = require('debug')('eye:supervisor:controller:host');
var config = require('config');
var _ = require('underscore');
var paramsResolver = require('../router/param-resolver');
var NotificationService = require('../service/notification');

var elastic = require('../lib/elastic');

module.exports = function(server, passport) {
  server.get('/host/:host',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'host'})
  ],controller.get);

  server.get('/host',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
  ],controller.fetch);

  server.post('/host/:hostname',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
  ],controller.create);

  return {
    routes: [
      {
        route: '/host',
        method: 'get',
        middleware: [],
        action: controller.fetch
      }, {
        route: '/host',
        method: 'post',
        middleware: [],
        action: controller.create
      }, {
        route: '/host/:host',
        method: 'get',
        middleware: [
          paramsResolver.idToEntity({param:'host'})
        ],
        action: controller.get
      },
    ]
  };
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
          'customer': customer.name,
          'hostname': host.hostname,
          'version': host.agent_version
        };

        var key = config.elasticsearch.keys.agent.version;
        elastic.submit(customer.name,key,data);
      }
      //if( host.agent_version != properties.agent_version ) {
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

var controller = {
  /**
   *
   *
   */
  get : function(req,res,next) {
    var host = req.host;
    if(!host) return res.send(404);

    host.publish(function(pub){
      res.send(200, {host:pub});
    });
  },
  /**
   *
   *
   */
  create : function(req, res, next)
  {
    var hostname = req.params.hostname;
    var customer = req.customer;
    var input = req.params.info;
    input.agent_version = req.params.version;

    if(!customer){
      let msg = json.error('customer is required');
      return res.send(400, msg);
    }

    debug('processing hostname "%s" registration request', hostname);

    registerHostname({
      'user':req.user,
      'customer': customer,
      'hostname': hostname,
      'host_properties': input
    }, function (error,result) {
      if(error) debug(error);

      var host = result.host;
      var resource = result.resource;

      debug('host "%s" registration completed.', hostname);

      var response = _.extend({
        "resource_id": resource ? resource._id : null,
        "host_id": host._id
      }, config.get("agent.core_workers.host_ping"));

      res.send(200, response); 
      next();
    });
  },
  /**
   *
   *
   */
  fetch : function(req,res,next) {
    var customer = req.customer;
    var scraper = req.params.scraper;

    if(!customer) return res.send(400, json.error('customer is required'));

    if(scraper) {
      HostService.fetchBy({customer_name: 'theeye'},function(error,hosts){
        if(error) res.send(500);
        else res.send(200,{'hosts':hosts});
      });
    } else {
      HostService.fetchBy({customer_name: customer.name},function(error,hosts){
        if(error) res.send(500);
        else res.send(200,{'hosts':hosts});
      });
    }
  }
};
