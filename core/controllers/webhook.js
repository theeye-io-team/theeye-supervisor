
const dbFilter = require('../lib/db-filter');
const logger = require('../lib/logger')('eye:controller:webhook');
const audit = require('../lib/audit');
const router = require('../router');
const App = require('../app');
const WebhookEvent = require('../entity/event').WebhookEvent;
const Webhook = require('../entity/webhook').Webhook;
const Constants = require('../constants')
const TopicsConstants = require('../constants/topics')
const { ClientError, ServerError } = require('../lib/error-handler')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  /** 
  * @openapi
  * /{customer}/webhook:
  *   get:
  *     summary: Get webhooks list
  *     description: Get a list of webhooks from specific customer.
  *     tags:
  *         - Webhook
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved webhook information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Webhook'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/webhook', middlewares, controller.fetch)

  /** 
  * @openapi
  * /{customer}/webhook/{webhook}:
  *   get:
  *     summary: Get webhook
  *     description: Get specific webhook from customer.
  *     tags:
  *         - Webhook
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Webhook
  *         in: query
  *         description: Webhook Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved webhook information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Webhook'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get(
    '/:customer/webhook/:webhook',
    middlewares,
    router.resolve.idToEntity({ param:'webhook', required:true }),
    controller.get
  )

  /** 
  * @openapi
  * /{customer}/webhook:
  *   post:
  *     summary: Create webhook
  *     description: Create a webhook for customer.
  *     tags:
  *         - Webhook
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Webhook'
  *     responses:
  *       '200':
  *         description: Successfully created webhook.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Webhook'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.post(
    '/:customer/webhook',
    middlewares,
    router.requireCredential('admin'),
    controller.create,
    audit.afterCreate('webhook',{display:'name'})
  )

  /** 
  * @openapi
  * /{customer}/webhook:
  *   put:
  *     summary: Update webhook
  *     description: Update a webhook from customer.
  *     tags:
  *         - Webhook
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Webhook
  *         in: query
  *         description: Webhook Id
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Webhook'
  *     responses:
  *       '200':
  *         description: Successfully updated webhook.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Webhook'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.put(
    '/:customer/webhook/:webhook',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'webhook', required: true }),
    controller.update,
    audit.afterUpdate('webhook',{display:'name'})
  )

  /** 
  * @openapi
  * /{customer}/webhook/{webhook}:
  *   delete:
  *     summary: Delete webhook
  *     description: Delete a webhook from customer.
  *     tags:
  *         - Webhook
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *       - name: Webhook
  *         in: query
  *         description: Webhook Id
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Webhook'
  *     responses:
  *       '200':
  *         description: Successfully deleted webhook.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Webhook'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

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
        if (err) {
          res.sendError(err)
        } else {
          res.send(200, webhooks)
        }
      })
  },
  /**
   * @method POST
   */
  create (req, res, next) {
    const input = Object.assign({},req.body,{
      customer: req.customer,
      customer_id: req.customer._id
    });

    const webhook = new Webhook(input)
    webhook.save(err => {
      if (err) {
        if (err.name == 'ValidationError') {
          res.send(400, err)
        } else {
          res.sendError(err)
        }
      } else {
        res.send(200, webhook)
        req.webhook = webhook
        next()
      }
    })
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
      if (err) {
        res.sendError(err)
      } else {
        res.send(200, webhook)
        next()
      }
    })
  },
  /**
   * @method GET
   */
  get (req, res, next) {
    const webhook = req.webhook;
    res.send(200, webhook);
  },
  /**
   * @method DELETE
   */
  remove (req, res, next) {
    const webhook = req.webhook;
    webhook.remove(err => {
      if (err) {
        res.sendError(err)
      } else {
        res.send(200,webhook)
        next()
      }
    });
  },
  /**
   * @method POST
   */
  async trigger (req, res) {
    try {
      const webhook = req.webhook
      const body = req.body

      const triggerEvent = await WebhookEvent.findOne({
        emitter_id: webhook._id,
        enable: true,
        name: 'trigger'
      })

      if (!triggerEvent) {
        throw new ServerError('webhook events are missing.')
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
    } catch (err) {
      res.sendError(err)
    }
  }
}
