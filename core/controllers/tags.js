const App = require('../app')

const router = require('../router')

module.exports = (server) => {

  /** 
  * @openapi
  * /{customer}/tag:
  *   get:
  *     summary: Get tag list
  *     description: Get a list of tags from specific customer.
  *     tags:
  *         - Tags
  *     parameters:
  *       - name: Customer
  *         in: query
  *         description: Customer Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved tag information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Tags'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/:customer/tag',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    fetchTags
  )

  /** 
  * @openapi
  * /{customer}/tag:
  *   get:
  *     summary: Get tag list
  *     description: Get a list of tags.
  *     tags:
  *         - Tags
  *     responses:
  *       '200':
  *         description: Successfully retrieved tag information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Tags'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  * 
  */

  server.get('/tag',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    fetchTags
  )
}

const fetchTags = async (req, res) => {
  try {
    const { customer } = req
    const tags = await App.Models.Tag.Tag
      .find({ customer: customer._id })
      .select({ name: 1 })

    res.send(200, tags)
  } catch (err) {
    res.sendError(err)
  }
}
