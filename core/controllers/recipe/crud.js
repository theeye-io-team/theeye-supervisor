
const App = require('../../app')
const logger = require('../../lib/logger')('controller:recipe')
const Recipe = require('../../entity/recipe').Recipe
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')

module.exports = (server) => {

  /** 
  * @openapi
  * /recipe/{recipe}:
  *   get:
  *     summary: Get specific recipe by Id
  *     description: Get only one recipe by it's id.
  *     tags:
  *       - Recipe
  *     parameters:
  *       - name: recipe
  *         in: query
  *         description: recipe id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved recipe information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Recipe'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */
  server.get('/recipe/:recipe',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.idToEntity({ param: 'recipe', required: true }),
    controller.get
  )

  /** 
  * @openapi
  * /recipe:
  *   get:
  *     summary: Get all recipes
  *     description: Get all recipes
  *     tags:
  *       - Recipe
  *     responses:
  *       '200':
  *         description: Successfully retrieved recipe information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Recipe'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.get('/recipe',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    controller.fetch
  )
}

const controller = {
  /**
   * @method GET
   */
  get (req, res, next) {
    return res.send(200, req.recipe)
  },
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
}
