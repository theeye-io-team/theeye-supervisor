'use strict'

const merge = require('lodash/merge')
const Recipe = require('../entity/recipe').Recipe
const router = require('../router')
const dbFilter = require('../lib/db-filter')

module.exports = (server, passport) => {
  var middlewares = [
    passport.authenticate('bearer', { session: false }),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer
  ]

  server.get(
    '/recipe/:recipe',
    middlewares.concat(
      router.resolve.idToEntity({ param: 'recipe', required: true })
    ),
    controller.get
  )

  server.get(
    '/recipe',
    middlewares,
    controller.fetch
  )
}

const controller = {
  /**
   * @method GET
   */
  fetch (req, res, next) {
    var input = req.query

    var filter = dbFilter(
      merge({}, (input || {}), {
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
    var recipe = req.recipe
    return res.send(200, recipe)
  }
}
