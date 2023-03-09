
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

  server.get('/:customer/webhook', middlewares, controller.fetch)

  server.get(
    '/:customer/webhook/:webhook',
    middlewares,
    router.resolve.idToEntity({ param:'webhook', required:true }),
    controller.get
  )

  server.post(
    '/:customer/webhook',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('webhook',{display:'name'})
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

  const auditTrigger = (req, res, next) => {
    const { user, customer, webhook } = req

    const payload = {
      operation: Constants.TRIGGER,
      user_id: user && (user._id || user.id),
      user_name: user && user.name,
      user_email: user && user.email,
      model_id: webhook._id,
      model_type: 'Webhook',
      model_name: webhook.name,
      organization: req.customer.name,
      organization_id: req.customer._id,
    }

    App.logger.submit(customer.name, TopicsConstants.webhook.triggered, payload)
  }

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
    controller.trigger,
    auditTrigger
  )

  // use custom middleware.
  // requesting user is anonymous, only need to provide secret token
  server.post(
    '/:customer/webhook/:webhook/trigger/secret/:secret',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param:'webhook', required: true }),
    router.requireSecret('webhook'),
    controller.trigger,
    auditTrigger
  )
}

const controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    var filter = dbFilter(
      Object.assign({}, (req.query||{}) , {
        where:{
          customer: req.customer._id
        }
      })
    )

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
  async create (req, res, next) {
    try {
      const input = Object.assign({}, req.body, {
        customer: req.customer,
        customer_id: req.customer._id
      })

      const webhook = new Webhook(input)
      await webhook.save()

      const wEvent = new WebhookEvent({
        name: 'trigger',
        customer: customer._id,
        emitter: webhook,
        emitter_id: webhook._id,
      })

      await wEvent.save()

      req.webhook = webhook
      res.send(200, webhook)
      next()
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   * @method PUT
   */
  update (req, res, next) {
    const webhook = req.webhook

    Object.assign(webhook, req.body, {
      customer_id: req.customer._id,
      customer: req.customer
    })

    webhook.save(err => {
      if(err) return res.send(500)
      res.send(200, webhook)
      next()
    })
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
  async remove (req, res, next) {
    try {
      const webhook = req.webhook
      await WebhookEvent.remove({ emitter_id: webhook._id })
      await webhook.remove()
      res.send(200, webhook)
      next()
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   * @method POST
   */
  async trigger (req, res, next) {
    try {
      const webhook = req.webhook
      const body = req.body

      const triggerEvent = await WebhookEvent.findOne({
        emitter_id: webhook._id,
        enable: true,
        name: 'trigger'
      })

      if (!triggerEvent) {
        return res.send(500, 'webhook events are missing.')
      }

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

      const params = App.jobDispatcher.parseOutputParameters(body)
      App.eventDispatcher.dispatch({
        topic: TopicsConstants.webhook.triggered,
        event: triggerEvent,
        data: params
      })

      webhook.trigger_count++
      webhook.save()

      res.send(200, { message: 'success' })
      next()
    } catch (err) {
      logger.error(err)
      res.send(500, err)
    }
  }
}
