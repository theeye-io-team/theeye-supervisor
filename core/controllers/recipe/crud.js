
const App = require('../../app')
const Recipe = require('../../entity/recipe').Recipe
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get(
    '/recipe/:recipe',
    middlewares,
    router.resolve.idToEntity({ param: 'recipe', required: true }),
    controller.get
  )

  server.get(
    '/recipe',
    middlewares,
    controller.fetch
  )

  server.get(
    '/recipe/host/:host/config',
    middlewares,
    router.resolve.idToEntity({ param: 'host', required: true }),
    controller.botRecipe
  )
}

const controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    let input = req.query

    let filter = dbFilter(
      Object.assign({}, (input || {}), {
        where: {
          customer: req.customer._id
        }
      })
    )

    Recipe.find(filter.where, (err, recipes) => {
      if (err) {
        logger.error(err)
        return res.send(500)
      }
      res.send(200, recipes)
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
  botRecipe (req, res, next) {
    const customer = req.customer
    const host = req.host
    App.host.config(host, customer, (err, recipe) => {
      res.send(200, recipe)
    })
  }
}
