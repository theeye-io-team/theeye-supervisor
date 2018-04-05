'use strict'

const systemConfig = require('config').system
const async = require('async')
const extend = require('util')._extend
const MONITORS = require('../constants/monitors')

var json = require('../lib/jsonresponse');
var logger = require('../lib/logger')('controller:agent');
var router = require('../router');
var NotificationService = require('../service/notification');
var ResourceManager = require('../service/resource');
var ResourceMonitorService = require('../service/resource/monitor');

const Host = require('../entity/host').Entity;
const File = require('../entity/file').File;
const User = require('../entity/user').Entity


module.exports = function (server, passport) {
	server.put('/:customer/agent/:hostname', [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({})
  ], controller.update)

  server.get('/:customer/agent/:hostname/config', [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
    router.resolve.hostnameToHost({})
  ], controller.config)

  server.get('/:customer/agent/credentials', [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
  ], controller.credentials)
}

const controller = {
  /**
   *
   * @path /:customer/agent/:hostname/config
   *
   */
  update (req, res, next) {
    var host = req.host
    if (!host) {
      logger.error('invalid request for %s. host not found', req.params.hostname)
      return res.send(404,'invalid host')
    }

    logger.log('receiving agent keep alive for host "%s"', host.hostname)

    host.last_update = new Date()
    host.save(err => {
      if (err) {
        logger.error(err)
        return res.send(500)
      }

      const query = { type: 'host', ensureOne: true }
      ResourceManager.findHostResources(host, query, (err, resource) => {
        if (err) {
          logger.error(err)
          return res.send(500)
        }
        
        if (!resource) {
          logger.error('host resource not found.')
          return res.send(503)
        }

        let handler = new ResourceManager(resource)
        handler.handleState({ state: MONITORS.RESOURCE_NORMAL })

        res.send(200)
        next()
      })
    })
  },
  /**
   *
   * @author Facundo
   * @method get
   * @path /:customer/agent/:hostname/config
   *
   */
  config (req, res, next) {
    const user = req.user
    const host = req.host
    const customer = req.customer

    if (!host) return res.send(400,'hostname required');
    if (!customer) return res.send(400,'customer required');
    if (!user) return res.send(400,'authentication required');

    ResourceMonitorService.findBy({
      enable: true,
      host_id: host._id,
      customer_id: customer._id
    }, function(error, monitors){
      if (error) return res.send(500);

      generateAgentConfig(monitors, function(err, config){
        if (err) return next(err);
        if (!config) {
          var err = new Error('unexpected error');
          err.statusCode = 500;
          return next(err);
        }

        res.send(200,config);
        next();
      });
    })
  },
  credentials (req, res, next) {
    const customer = req.customer

    User.findOne({
      credential: 'agent',
      'customers.name': customer.name
    }).exec((err, agent) => {
      if (err) return next(err)

      if (agent===null) return res.send(404,'agent not found')

      const baseConfig = {
        supervisor: {
          api_url: systemConfig.base_url,
          client_id: agent.client_id,
          client_secret: agent.client_secret,
          client_customer: customer.name
        }
      }

      return res.send(200, baseConfig)
    })
  }
}

const generateAgentConfig = (monitors,next) => {
  var workers = [];
  async.each(monitors,function(monitor,doneIteration){
    var config = {
      type: monitor.type,
      name: monitor.name,
      looptime: monitor.looptime,
      resource_id: monitor.resource_id
    }

    logger.log('setting up monitor configuration');
    (function(configDone) {
      switch (monitor.type) {
        case 'file':
          var fileId = monitor.config.file;
          File.findById(fileId,function(err,file){
            if (err) {
              configDone(err);
            } else if (file===null) {
              var error = new Error('Invalid or not present file id in worker config. File specification not available');
              error.statusCode = 500;
              throw error;
              configDone(error);
            } else {
              monitor.publish({},(err,m) => {
                file.publish((err,f) => {
                  config = extend(config, m.config);
                  config.file = f;
                  configDone(null,config);
                });
              });
            }
          });
          break;
        case 'scraper':
          config = extend(config,monitor.config);
          configDone(null, config);
          break;
        case 'process':
          config.ps = monitor.config.ps;
          configDone(null, config);
          break;
        case 'script':
          File.findById(monitor.config.script_id, function(err,script){
            if (err) {
              return configDone(err);
            } else if (script==null) {
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
          logger.log(error);
          configDone(error);
          break;
      }
    })(function(error, config){
      if(!error && config) workers.push(config);
      doneIteration();
    });
  },function(err){
    logger.log('completed');
    if (err) {
      logger.log('some monitor produces an error. %s', err);
      next(err);
    }
    else next(null,{ workers : workers });
  });
}
