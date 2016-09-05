var debug = require('debug')('eye:supervisor:controller:resource');
var json = require('../lib/jsonresponse');
var _ = require('lodash');

var ResourceMonitor = require('../entity/monitor').Entity;
var paramsResolver = require('../router/param-resolver');

module.exports = function(server, passport) {

  server.get('/monitor/:resource-monitor', [
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({ param:'resource-monitor' })
  ], controller.get);

  server.get('/monitor', [
    passport.authenticate('bearer', {session:false}),
    paramsResolver.customerNameToEntity({}),
    paramsResolver.idToEntity({ param:'resource' })
  ], controller.fetch);
}

var controller = {
  /**
   *
   *
   */
  get : function(req, res, next) {
    var monitor = req['resource-monitor'];
    if(!monitor) return res.send(404, json.error('monitor not found'));

    debug('publishing monitor');
    monitor.publish({},function(error, pub){
      res.send(200, { 'monitor': pub });
    }); 
  },
  /**
   *
   *
   */
  fetch : function(req,res,next) {
    var customer = req.customer;
    var resource = req.resource;
    var type = req.query.type;

    if(!customer) return res.send(400, json.error('customer is required'));

    var query = {
      customer_name: customer.name
    };

    if(resource != null) query.resource_id = resource._id;
    if(typeof type != 'undefined') query.type = type;

    debug('fetching monitors by %j', query);

    ResourceMonitor
      .find(query)
      .sort({ 'host_id':1, 'type':1 })
      .exec(function(err, monitors){

        var total = monitors.length;
        if(total==0) return res.send(200, { monitors: [] });

        var data = [];
        var published = _.after(total, function(){
          res.send(200, { 'monitors': data });
        });

        for(var i=0; i<total; i++){
          var monitor = monitors[i];
          monitor.publish({ 
            'populate' : true 
          },function(err,pub){
            if(pub != null) data.push(pub);
            published();
          }); 
        }
      });
  }
};
