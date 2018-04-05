const App = require('../../app')
const audit = require('../../lib/audit')
const router = require('../../router');
const TopicsConstants = require('../../constants/topics')
const MonitorConstants = require('../../constants/monitors')
const MonitorManager = require('../../service/resource/monitor');
const crudTopic = TopicsConstants.monitor.crud

module.exports = (server, passport) => {
  // default middlewares
  var middlewares = [
    passport.authenticate('bearer',{ session: false }),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.post(
    '/resource/nested',
    middlewares.concat([
      router.requireCredential('admin'),
      router.filter.spawn({
        filter: 'emailArray',
        param: 'acl'
      })
    ]),
    controller.create
  )

  server.patch(
    '/resource/nested/:resource',
    middlewares.concat([
      router.requireCredential('admin'),
      router.resolve.idToEntity({
        param: 'resource',
        required: true
      }),
      router.filter.spawn({
        filter: 'emailArray',
        param: 'acl'
      })
    ]),
    controller.update
  )
}

const controller = {
  /**
   * @method POST
   */
  create (req, res, next) {
    const customer = req.customer
    const body = req.body

    let params = MonitorManager.validateData(body)
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    let input = params.data
    input.user = req.user
    input.customer = customer
    input.customer_id = customer.id
    input.customer_name = customer.name
    input.type = MonitorConstants.RESOURCE_TYPE_NESTED
    // clean
    input.template = null
    input.monitor = null // will be created automatically

    App.resource.create(input, (err, result) => {
      if (err) {
        res.send(err.statusCode || 500, err.errors)
      } else {
        res.send(201, result.resource)
        next()
      }
    })
  },
  /**
   * @method PATCH
   */
  update (req, res, next) {
    const resource = req.resource
    const body = req.body
    var updates

    const params = MonitorManager.validateData(body)
    if (params.errors && params.errors.hasErrors()) {
      return res.send(400, params.errors)
    }

    updates = params.data
    updates.acl = req.acl

    App.resource.update({
      resource,
      updates
    }, (err, resource) => {
      if (err) {
        logger.error(err)
        res.send(500)
      } else {
        App.resource.populate(resource, () => {
          res.send(200,resource)
          next()
        })
      }
    })
  }
}
