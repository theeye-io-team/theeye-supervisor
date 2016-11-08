"use strict";

var extend = require('lodash/assign');
var dbFilter = require('../lib/db-filter');
var logger = require('../lib/logger')('eye:controller:webhook');
var audit = require('../lib/audit');
var router = require('../router');
var resolve = router.resolve;

const EventDispatcher = require('../service/events');
const WebhookEvent = require('../entity/event').WebhookEvent;
const Webhook = require('../entity/webhook').Webhook;

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session:false }),
    resolve.customerNameToEntity({ required:true }),
    router.ensureCustomer, // requesting user is authorized to access the customer
  ];

  server.get(
    '/:customer/webhook',
    middlewares,
    controller.fetch
  );

  server.post(
    '/:customer/webhook',
    middlewares,
    controller.create,
    audit.afterCreate('webhook',{display:'name'})
  );

  server.get(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.get
  );

  server.put(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.update,
    audit.afterUpdate('webhook',{display:'name'})
  );

  server.del(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      resolve.idToEntity({
        param:'webhook',
        required: true
      })
    ),
    controller.remove,
    audit.afterRemove('webhook',{display:'name'})
  );

  /**
   *
   * trigger webhook event
   *
   */
  server.post(
    '/:customer/webhook/:webhook/trigger',
    middlewares.concat(
      resolve.idToEntity({ param:'webhook', required: true })
    ),
    controller.trigger
  );

  server.post(
    '/:customer/webhook/:webhook/trigger/secret/:secret',
    [
      resolve.customerNameToEntity({ required: true }),
      resolve.idToEntity({ param:'webhook', required: true }),
      function (req,res,next) { // validate secret
        var secret = req.params.secret;
        if( ! secret ) return res.send(403,'secret is required');
        if( secret.length != 64 ) return res.send(403,'invalid secret');
        if( req.webhook.secret != secret ) return res.send(403,'invalid secret');
        next();
      }
    ],
    controller.trigger
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
          customer: req.customer._id
        }
      })
    );

    Webhook.find(filter.where, (err, webhooks) => {
      if(err) {
        logger.error(err);
        return res.send(500);
      }
      res.send(200, webhooks);
    });
  },
  /**
   * @method POST
   */
  create (req, res, next) {
    var input = extend({},req.body,{
      customer: req.customer
    });

    var webhook = new Webhook(input);
    webhook.save(err => {
      if(err){
        if( err.name == 'ValidationError' )
          return res.send(400, err);
        else return res.send(500);
      }
      res.send(200, webhook);
      req.webhook = webhook;
      next();
    });
  },
  /**
   * @method PUT
   */
  update (req, res, next) {
    var webhook = req.webhook;
    var input = extend({},req.body,{
      customer: req.customer
    });

    extend(webhook,input);

    webhook.save(err => {
      if(err) return res.send(500);
      res.send(200, webhook);
      next();
    });
  },
  /**
   * @method GET
   */
  get (req, res, next) {
    var webhook = req.webhook;
    return res.send(200, webhook);
  },
  /**
   * @method DELETE
   */
  remove (req, res, next) {
    var webhook = req.webhook;
    webhook.remove(err => {
      if(err) return res.send(500);
      res.send(200,webhook);
      next();
    });
  },
  /**
   * @method POST
   */
  trigger (req, res, next) {
    var webhook = req.webhook;

    WebhookEvent.findOne({
      emitter: webhook._id
    },(err, event) => {

      if( err ){
        return res.send(500, err);
      }
      if( ! event ) return res.send(500);

      EventDispatcher.dispatch( event );
      res.send(200,{ message: 'success' });
      next();
    });
  }
}
