var debug = require('debug')('eye:controller:resource');
var json = require('../lib/jsonresponse');
var ResourceManager = require('../service/resource');
var MonitorManager = require('../service/resource/monitor');
var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var Job = require('../entity/job').Job;
var resolver = require('../router/param-resolver');
var dbFilter = require('../lib/db-filter');

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer',{session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'resource'})
  ];

  server.get   ( '/:customer/resource'                  , middlewares , controller.fetch);
  server.get   ( '/:customer/resource/:resource'        , middlewares , controller.get);
  server.post  ( '/:customer/resource'                  , middlewares , controller.create);
  server.put   ( '/:customer/resource/:resource'        , middlewares , controller.update);
  //server.put   ( '/resource/:resource'                  , middlewares , controller.update);
  server.del   ( '/:customer/resource/:resource'        , middlewares , controller.remove);
  server.patch ( '/:customer/resource/:resource/alerts' , middlewares , controller.alerts);

  server.patch(
    '/:customer/resource/:resource',
    middlewares.concat( resolver.idToEntity({param:'host'}) ),
    controller.patch
  );

}

var controller = {
  get : function(req,res,next) {
    var resource = req.resource;
    if(!resource) return res.send(404,json.error('not found'));

    resource.publish(function(err, pub){
      res.send(200, { 'resource': pub });
    });
  },
  fetch : function(req,res,next) {
    if(!req.customer){
      return res.send(403,json.error('specify an organization'));
    }

    var filter = dbFilter(req.query,{
      sort: {
        fails_count: -1,
        type: 1 
      }
    });

    filter.where.customer_id = req.customer._id;

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
  remove : function(req,res,next) {
    var resource = req.resource;
    if(!resource) return res.send(404,json.error('not found'));

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
  update : function(req,res,next) {
    var resource = req.resource;
    var input = req.params;
    var state = req.params.state ;

    if(!resource) {
      res.send(404,json.error('resource not found'));
      return next();
    }

    if(!state) {
      res.send(400,json.error('resource state is required'));
      return next();
    }

    var manager = new ResourceManager(resource);
    manager.handleState(input,function(error){
      if(!error) {
        res.send(200);
      } else {
        res.send(500, json.error('internal server error'));
      }
    });
  },
  /**
   *
   *
   */
  create : function(req,res,next) {
    var customer = req.customer;
    var hosts = req.body.hosts;

    if( ! customer ) return res.send(400, json.error('customer is required'));
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
   * this is PUT not PATCH ! but PUT is taken above to update resource status.
   * will change when resource status is changed via events -
   *
   * @author Facugon
   *
   */
  patch : function(req,res,next) {
    var resource = req.resource;
    if(!resource) return res.send(404,json.error('resource not found'));

    var params = MonitorManager.validateData(req.body);
    if( params.errors && params.errors.hasErrors() ) return res.send(400, params.errors);

    var input = params.data;
    if(req.host) input.host = req.host;

    ResourceManager.update({
      resource:resource,
      updates:input,
      user:req.user
    },function(error, result){
      if(error) res.send(500,json.error('update error', error.message));
      else res.send(200, result);
    });
  },
  /**
   *
   * change resource send alerts status.
   * @author Facugon
   *
   */
  alerts (req, res, next) {
    if(!req.resource) return res.send(404);
    if(!req.customer) return res.send(400,'Customer required');
    var resource = req.resource;
    resource.alerts = req.params.alerts;
    resource.save(error => {
      if(error) res.send(500);
      else res.send(200, resource);
    });
  }
};
