var debug = require('debug')('controller:resource');
var json = require('../lib/jsonresponse');
var _ = require('lodash');

var ResourceMonitor = require('../entity/monitor').Entity;
var router = require('../router');

module.exports = function (server, passport) {
  server.get('/:customer/monitor/:resource-monitor', [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'resource-monitor',required:true})
  ], controller.get);

  server.get('/:customer/monitor', [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'resource'})
  ], controller.fetch);
}

var controller = {
  /**
   *
   *
   */
  get (req,res,next) {
    var monitor = req['resource-monitor'];
    monitor.publish({},(error, pub) => {
      res.send(200, { 'monitor': pub }) 
    });
  },
  /**
   *
   *
   */
  fetch (req,res,next) {
    var customer = req.customer;
    var resource = req.resource;
    var type = req.query.type;

    var query = { customer_name: customer.name };

    if (resource!=null) query.resource_id = resource._id;
    if (typeof type != 'undefined') query.type = type;

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
