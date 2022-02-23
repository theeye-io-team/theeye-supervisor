
const App = require('../../app')
const logger = require('../../lib/logger')('controller:recipe')
const Recipe = require('../../entity/recipe').Recipe
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')

module.exports = (server) => {

  server.get('/recipe/:recipe',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'recipe', required: true }),
    controller.get
  )

  server.get('/recipe',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    controller.fetch
  )

  server.get('/recipe/host/:host/config',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'host', required: true }),
    controller.recipe
  )
}

const controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    const { query, customer } = req

    const filter = dbFilter(query, {})
    filter.where.customer_id = customer.id

    Recipe.fetchBy(filter, (err, recipes) => {
      if (err) {
        return res.sendError(err)
      } else {
        res.send(200, recipes)
      }
    })
  },
  /**
   * @method GET
   */
  get (req, res, next) {
    return res.send(200, req.recipe)
  },
  /**
   * @method GET
   */
  async recipe (req, res, next) {
    try {
      const customer = req.customer
      const host = req.host
      const recipe = await App.host.config(host, customer)
      res.send(200, recipe)
    } catch (err) {
      logger.error(err)
      res.send(500, err)
    }
  }
}
