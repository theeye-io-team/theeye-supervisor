var _ = require('underscore');
var debug = require('debug')('eye:supervisor:controller:resource');
var json = require('../lib/jsonresponse');
var ResourceManager = require('../service/resource');
var StateHandler = require('../service/resource-state-handler');
var Resource = require('../entity/resource').Entity;
var ResourceMonitor = require('../entity/monitor').Entity;
var Host = require('../entity/host').Entity;
var Job = require('../entity/job').Entity;
var resolver = require('../router/param-resolver');
var filter = require('../router/param-filter');

module.exports = function(server, passport) {
  server.get('/:customer/resource',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({param:'host'})
  ], controller.fetch);

  server.get('/:customer/resource/:resource',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'resource'})
  ], controller.get);

  server.post('/:customer/resource',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
  ], controller.create);

  server.put('/:customer/resource/:resource',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'resource'})
  ], controller.update);

  server.put('/resource/:resource',[
    //resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'resource'})
  ], controller.update);

  server.patch('/:customer/resource/:resource',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'host'}),
    resolver.idToEntity({param:'resource'})
  ], controller.patch);

  server.del('/:customer/resource/:resource',[
    resolver.customerNameToEntity({}),
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({param:'resource'})
  ], controller.remove);
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
    if(!req.customer) return res.send(400,json.error('customer is required'));

    var input = { customer: req.customer, host: req.host };
    if(req.query.type) input.type = req.query.type;

    ResourceManager.fetchBy(input,function(error,resources){
      if(error||!resources) {
        res.send(500);
      } else {
        res.send(200,{ resources : resources });
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

    // NEW EVENT HANDLER STILL NOT IMPLEMENTED
    //var handler = new StateHandler(resource, state);
    //handler.handleState(function(error)
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

    var params = ResourceManager.setResourceMonitorData(req.body);
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
          _.each(error.errors,function(e,i){
            messages.push({field:e.path, type:e.kind});
          });

          return res.send(400, json.error(
            error.message, 
            {errors:messages} 
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
   *
   */
  patch : function(req,res,next)
  {
    var resource = req.resource;
    if(!resource) return res.send(404,json.error('resource not found'));

    var params = ResourceManager.setResourceMonitorData(req.body);
    if( params.errors && params.errors.hasErrors() ){
      return res.send(400, params.errors);
    }

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
  }
};
