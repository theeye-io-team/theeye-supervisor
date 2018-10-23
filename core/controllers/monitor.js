var debug = require('debug')('controller:monitor');
var after = require('lodash/after');
var ResourceMonitor = require('../entity/monitor').Entity;
var router = require('../router');
var dbFilter = require('../lib/db-filter');

module.exports = function (server, passport) {
  // old api. old monitors page
  server.get('/:customer/monitor/:monitor', [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'monitor',required:true})
  ], controller.get);

  server.get('/:customer/monitor', [
    passport.authenticate('bearer',{session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'resource'})
  ], controller.fetch);

  // new api. new cruds
}

var controller = {
  /**
   *
   *
   */
  get (req,res,next) {
    var monitor = req.monitor;
    res.send(200,monitor);
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
        if(total==0) return res.send(200,[]);

        var data = [];
        var published = after(total, function(){
          res.send(200, data);
        });

        for(var i=0; i<total; i++){
          var monitor = monitors[i];
          monitor.publish({ populate: true }, function (err, pub) {
            if(pub != null) data.push(pub);
            published();
          }); 
        }
      });
  }
};
