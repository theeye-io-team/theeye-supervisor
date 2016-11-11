'use strict';

var debug = require('debug')('eye:controller:resource');
var json = require('../lib/jsonresponse');
var ResourceManager = require('../service/resource');
var MonitorManager = require('../service/resource/monitor');
var Resource = require('../entity/resource').Entity;
var Monitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var Job = require('../entity/job').Job;
var router = require('../router');
var dbFilter = require('../lib/db-filter');
var ACL = require('../lib/acl');

module.exports = function (server, passport) {
  // default middlewares
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ];

  server.get('/:customer/resource',middlewares.concat([
    router.requireCredential('viewer'),
  ]),controller.fetch);

  server.get('/:customer/resource/:resource',middlewares.concat([
    router.requireCredential('viewer'),
    router.resolve.idToEntity({param:'resource',required:true}),
    router.ensureAllowed({entity:'resource'})
  ]),controller.get);

  server.put('/:customer/resource/:resource',middlewares.concat([
    router.requireCredential('agent',{exactMatch:true}),
    router.resolve.idToEntity({param:'resource',required:true})
  ]),controller.update);

  server.post('/:customer/resource',middlewares.concat([
    router.requireCredential('admin'),
  ]),controller.create);

  server.del('/:customer/resource/:resource',middlewares.concat([
    router.requireCredential('admin'),
    router.resolve.idToEntity({param:'resource',required:true})
  ]),controller.remove);

  server.patch(
    '/:customer/resource/:resource/alerts',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param:'resource',required:true})
    ]),
    controller.alerts
  );

  server.patch(
    '/:customer/resource/:resource',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({param:'resource',required:true}),
      router.resolve.idToEntity({param:'host'}),
      router.filter.spawn({filter:'emailArray',param:'acl'})
    ]),
    controller.patch
  );
}

var controller = {
  get (req,res,next) {
    var resource = req.resource;
    Monitor
      .findOne({ resource: resource._id })
      .exec(function(err,monitor){
        var data = resource.toObject();
        data.monitor = monitor;
        res.send(200, { resource: data });
      });
  },
  fetch (req,res,next) {

    var filter = dbFilter(req.query,{
      sort: {
        fails_count: -1,
        type: 1 
      }
    });

    filter.where.customer_id = req.customer._id;
    if ( !ACL.hasAccessLevel(req.user.credential,'admin') ) {
      // find what this user can access
      filter.where.acl = req.user.email ;
    }

    ResourceManager.fetchBy(filter,function(error,resources){
      if(error||!resources) {
        res.send(500);
      } else {
        res.send(200, resources);
      }
    });
  },
  /**
   *
   *
   *
   */
  remove (req,res,next) {
    var resource = req.resource;

    if(resource.type == 'host') {
      debug('removing host resource');
      ResourceManager.removeHostResource({
        resource:resource,
        user:req.user
      });
      res.send(204);
    } else {
      debug('removing resource');
      ResourceManager.remove({
        resource:resource,
        notifyAgents:true,
        user:req.user
      });
      res.send(204);
    }
  },
  update (req,res,next) {
    var resource = req.resource;
    var input = req.params;
    var state = req.params.state;

    if(!state){
      res.send(400,json.error('resource state is required'));
      return next();
    }

    var manager = new ResourceManager(resource);
    input.last_update = new Date();
    manager.handleState(input,function(error){
      if(!error) {
        res.send(200);
      } else {
        res.send(500,json.error('internal server error'));
      }
    });
  },
  /**
   *
   *
   */
  create (req,res,next) {
    var customer = req.customer;
    var hosts = req.body.hosts;

    if( ! hosts ) return res.send(400, json.error('hosts are required'));
    if( ! Array.isArray(hosts) ) hosts = [ hosts ];

    var params = MonitorManager.validateData(req.body);
    if( params.errors && params.errors.hasErrors() ){
      return res.send(400, params.errors);
    }

    var input = params.data;
    input.user = req.user;
    input.customer = customer;
    input.customer_id = customer.id;
    input.customer_name = customer.name;

    ResourceManager.createResourceOnHosts(hosts,input,function(error,results){
      if(error) {
        if(error.errors) {
          var messages=[];
          for(var err in error.errors){
            var e = errors[err];
            messages.push({
              field: e.path,
              type: e.kind
            });
          }

          return res.send(400, json.error(
            error.message,
            { errors: messages }
          ));
        } else {
          debug(error);
          return res.send(500, json.error('internal error', error));
        }
      } else {
        debug('resources created');
        return res.send(201, results);
      }
    });
  },
  /**
   *
   * this is PUT not PATCH !
   * but PUT is taken above to update resource status.
   *
   * @author Facugon
   *
   */
  patch (req,res,next) {
    var resource = req.resource;
    var body = req.body;
    body.host = req.host;
    body.acl = req.acl;

    var params = MonitorManager.validateData(body);
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors);
    }

    var updates = params.data;
    if (updates.type=='host') {

      resource.acl = req.acl;
      resource.save(err => {
        if (err) {
          res.send(500,err);
        } else {
          res.send(200,resource);
        }
      });

    } else {

      ResourceManager.update({
        resource: resource,
        updates: updates,
        user: req.user
      },function(error, result){
        if (error) {
          res.send(500,json.error('update error', error.message));
        } else {
          res.send(200, result);
        }
      });
    }
  },
  /**
   *
   * change resource send alerts status.
   * @author Facugon
   *
   */
  alerts (req, res, next) {
    var resource = req.resource;
    resource.alerts = req.params.alerts;
    resource.save(error => {
      if(error) res.send(500);
      else res.send(200, resource);
    });
  }
};
