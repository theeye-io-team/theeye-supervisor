
const extend = require('lodash/assign');
const dbFilter = require('../lib/db-filter');
const logger = require('../lib/logger')('eye:controller:webhook');
const audit = require('../lib/audit');
const router = require('../router');
const App = require('../app');
const WebhookEvent = require('../entity/event').WebhookEvent;
const Webhook = require('../entity/webhook').Webhook;
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get(
    '/:customer/webhook',
    middlewares,
    controller.fetch
  )

  server.post(
    '/:customer/webhook',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('webhook',{display:'name'})
  )

  server.get(
    '/:customer/webhook/:webhook',
    middlewares,
    router.resolve.idToEntity({ param:'webhook', required:true }),
    controller.get
  )

  server.put(
    '/:customer/webhook/:webhook',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'webhook', required: true }),
    controller.update,
    audit.afterUpdate('webhook',{display:'name'})
  )

  server.del(
    '/:customer/webhook/:webhook',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'webhook', required: true }),
    controller.remove,
    audit.afterRemove('webhook',{display:'name'})
  )

  /**
   *
   * trigger webhook event
   *
   */
  server.post(
    '/:customer/webhook/:webhook/trigger',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param:'webhook', required:true }),
    router.ensureAllowed({ entity:{name:'webhook'} }),
    controller.trigger
  )

  // use custom middleware.
  // requesting user is anonymous, only need to provide secret token
  server.post(
    '/:customer/webhook/:webhook/trigger/secret/:secret',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param:'webhook', required: true }),
    router.requireSecret('webhook'),
    controller.trigger
  )
}

const controller = {
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

    Webhook
      .find(filter.where)
      .populate('customer')
      .exec((err, webhooks) => {
        if(err) {
          logger.error(err);
          return res.send(500);
        }
        res.send(200, webhooks)
      })
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
    const webhook = req.webhook
    const body = req.body

    App.notifications.generateSystemNotification({
      topic: TopicsConstants.webhook.triggered,
      data: {
        model_id: webhook._id,
        model_type: 'Webhook',
        model: webhook,
        organization: req.customer.name,
        organization_id: req.customer._id,
        operation: Constants.TRIGGER
      }
    })

    WebhookEvent.findOne({
      emitter_id: webhook._id,
      enable: true,
      name: 'trigger'
    }, (err, event) => {
      if (err) { return res.send(500, err) }
      if (!event) { return res.send(500, 'webhook events are missing.') }

      let output = App.jobDispatcher.parseOutputParameters(body)
      App.eventDispatcher.dispatch({
        topic: TopicsConstants.webhook.triggered,
        event,
        output
      })

      res.send(200, { message: 'success' })
      next()
    })
  }
}
