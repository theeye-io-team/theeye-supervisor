"use strict";

var router = require('../router');
var resolve = router.resolve;
var debug = require('debug')('eye:controller:trigger');
var dbFilter = require('../lib/db-filter');
var Trigger = require('../entity/trigger').Trigger;
var extend = require('lodash/assign');

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session:false }),
    resolve.customerNameToEntity({ required:true }),
    router.userCustomer, // requesting user is authorized to access the customer
  ];

  server.get(
    '/:customer/trigger',
    middlewares,
    controller.fetch
  );

  server.post(
    '/:customer/trigger',
    middlewares,
    controller.create
  );

  server.get(
    '/:customer/trigger/:trigger',
    middlewares.concat(
      resolve.idToEntity({
        param:'trigger',
        required: true
      })
    ),
    controller.get
  );

  server.put(
    '/:customer/trigger/:trigger',
    middlewares.concat(
      resolve.idToEntity({
        param:'trigger',
        required: true
      })
    ),
    controller.update
  );

  server.del(
    '/:customer/trigger/:trigger',
    middlewares.concat(
      resolve.idToEntity({
        param:'trigger',
        required: true
      })
    ),
    controller.remove
  );
}

var controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    var filter = dbFilter(
      extend( (req.query||{}) , {
        where:{
          customer: req.customer
        }
      })
    );

    Trigger.find(filter.where, (err, triggers) => {
      if(err) return res.send(500);
      res.send(200, triggers);
    });
  },
  /**
   * @method POST
   */
  create (req, res, next) {
    var input = extend({},req.body,{
      customer: req.customer
    });

    var trigger = new Trigger(input);
    trigger.save(err => {
      if(err){
        if( err.name == 'ValidationError' )
          return res.send(400, err);
        else return res.send(500);
      }
      res.send(200, trigger);
      next();
    });
  },
  /**
   * @method PUT
   */
  update (req, res, next) {
    var trigger = req.trigger;
    var input = extend({},req.body,{
      customer: req.customer
    });

    extend(trigger,input);

    trigger.save(err => {
      if(err) return res.send(500);
      res.send(200, trigger);
    });
  },
  /**
   * @method GET
   */
  get (req, res, next) {
    var trigger = req.trigger;
    return res.send(200, trigger);
  },
  /**
   * @method DELETE
   */
  remove (req, res, next) {
    var trigger = req.trigger;
    trigger.remove(err => {
      if(err) return res.send(500);
      res.send(204);
    });
  },
}
