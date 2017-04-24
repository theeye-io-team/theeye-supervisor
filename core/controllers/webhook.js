'use strict';

var extend = require('lodash/assign');
var dbFilter = require('../lib/db-filter');
var logger = require('../lib/logger')('eye:controller:webhook');
var audit = require('../lib/audit');
var router = require('../router');

const EventDispatcher = require('../service/events');
const WebhookEvent = require('../entity/event').WebhookEvent;
const Webhook = require('../entity/webhook').Webhook;

module.exports = function (server, passport) {
  var middlewares = [
    passport.authenticate('bearer', { session:false }),
    router.resolve.customerNameToEntity({ required:true }),
    router.ensureCustomer
  ];

  server.get(
    '/:customer/webhook',
    middlewares,
    controller.fetch
  );

  server.post(
    '/:customer/webhook',
    middlewares.concat(
      router.requireCredential('admin')
    ),
    controller.create,
    audit.afterCreate('webhook',{display:'name'})
  );

  server.get(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      router.resolve.idToEntity({ param:'webhook', required:true })
    ),
    controller.get
  );

  server.put(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param:'webhook', required: true })
    ),
    controller.update,
    audit.afterUpdate('webhook',{display:'name'})
  );

  server.del(
    '/:customer/webhook/:webhook',
    middlewares.concat(
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param:'webhook', required: true })
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
      router.requireCredential('user'),
      router.resolve.idToEntity({ param:'webhook', required:true }),
      router.ensureAllowed({ entity:{name:'webhook'} })
    ),
    controller.trigger
  );

  // use custom middleware.
  // requesting user is anonymous, only need to provide secret token
  server.post(
    '/:customer/webhook/:webhook/trigger/secret/:secret', [
      router.resolve.customerNameToEntity({ required: true }),
      router.resolve.idToEntity({ param:'webhook', required: true }),
      router.requireSecret('webhook')
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
      customer: req.customer,
      customer_id: req.customer._id
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
      customer_id: req.customer._id,
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
      if (err) return res.send(500, err);
      if (!event) return res.send(500);

      EventDispatcher.dispatch(event);
      res.send(200,{ message: 'success' });
      next();
    });
  }
}
