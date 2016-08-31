"use strict";
var Script = require("../entity/script").Entity;
var json = require("../lib/jsonresponse");
var debug = require('debug')('eye:supervisor:controller:agent-config');
var async = require('async');
var paramsResolver = require('../router/param-resolver');
var ResourceMonitorService = require("../service/resource/monitor");
var extend = require('util')._extend;

module.exports = function(server, passport) {
  server.get('/:customer/agent/:hostname/config',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.hostnameToHost({})
  ],controller.fetch);
}

/**
 *
 * @route /:customer/agent/:hostname/config
 * agent-config controller
 *
 */
var controller = {
  /**
   *
   * @author Facundo
   * @method get
   * @path /:customer/agent/:hostname/config
   *
   */
  fetch: function (req, res, next) {
    var user = req.user;
    var host = req.host;
    var customer = req.customer;

    if(!host) return res.send(400,'hostname required');
    if(!customer) return res.send(400,'customer required');
    if(!user) return res.send(400,'authentication required');

    ResourceMonitorService.findBy({
      'enable': true,
      'host_id': host._id,
      'customer_id': customer._id
    }, function(error, monitors){
      if(error) res.send(500);
      generateAgentConfig(monitors, function(config){
        if(!config) return res.send(500);
        res.send(200,config);
      });
    })
  }
};

function generateAgentConfig(monitors,next) {
  var workers = [];
  async.each(monitors,function(monitor,doneIteration){
    var config = {
      "type" : monitor.type,
      "name" : monitor.name,
      "looptime" : monitor.looptime,
      "resource_id" : monitor.resource_id
    }

    debug('setting up monitor configuration');
    (function(configDone){
      switch(monitor.type){
        case 'scraper':
          config = extend(config,monitor.config);
          configDone(null, config);
          break;
        case 'process':
          config.ps = monitor.config.ps;
          configDone(null, config);
          break;
        case 'script':
          Script.findById(monitor.config.script_id, function(err,script){
            if(err) return configDone(err);
            else if(script==null) {
              var error = new Error('invalid script id for worker config. script not available');
              error.statusCode = 500;
              throw error;
              configDone(error);
            } else {
              script.publish(function(err,data){
                config.script = data;
                config.script.arguments = monitor.config.script_arguments||[];
                config.script.runas = monitor.config.script_runas||'';
                configDone(null, config);
              });
            }
          });
          break;
        case 'dstat':
          config.limit = monitor.config.limit;
          configDone(null, config);
          break;
        case 'psaux':
          configDone(null, config);
          break;
        case 'host':
          configDone();
        break;
        default:
          let msg=`unhandled monitor type ${monitor.type}`;
          let error = new Error();
          debug(error);
          configDone(error);
          break;
      }
    })(function(error, config){
      if(!error && config) workers.push(config);
      doneIteration();
    });

  },function(err){
    debug('completed');
    if(err){
      debug('some monitor produces an error');
      debug(err.message);
      next(null);
    }
    else next({ workers : workers });
  });
}
