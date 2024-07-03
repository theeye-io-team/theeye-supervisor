const App = require('../../app')
const router = require('../../router');

module.exports = (server) => {

  /** 
  * @openapi
  * /workflows/{workflow}/serialize:
  *   get:
  *     summary: Get workflow recipe.
  *     description: Get specific workflow recipe.
  *     tags:
  *         - Workflow
  *     parameters:
  *       - name: Workflow
  *         in: query
  *         description: Workflow Id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       '200':
  *         description: Successfully retrieved workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.get(
    '/workflows/:workflow/serialize',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param: 'workflow', required: true }),
    router.ensureAllowed({ entity: { name: 'workflow' } }),
    serialize
  )

  /** 
  * @openapi
  * /workflows/import:
  *   post:
  *     summary: Import workflow recipe.
  *     description: Import specific workflow recipe.
  *     tags:
  *         - Workflow
  *     requestBody:
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/Workflow'
  *     responses:
  *       '200':
  *         description: Successfully retrieved workflow information.
  *         content:
  *           application/json:
  *             schema:
  *               type: array
  *               items:
  *                 $ref: '#/components/schemas/Workflow'
  *       '401':
  *         description: Authentication failed.
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/Error'
  *
  */

  server.post(
    '/workflows/import',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    create
  )
}

/**
 * @summary export workflow recipe
 */
const serialize = async (req, res) => {
  try {
    const { mode = 'shallow' } = req.query
    const workflow = req.workflow
    const serial = await App.workflow.serialize(workflow, { mode })
    res.send(200, serial)
  } catch (err) {
    res.sendError(err)
  }
}

/**
 * @summary import workflow recipe
 */
const create = (req, res, next) => {
  const serialization = req.body
  res.send(200)
}

