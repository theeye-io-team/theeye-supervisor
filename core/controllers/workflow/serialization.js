const App = require('../../app')
const router = require('../../router');

module.exports = (server) => {
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
    return res.send(200, serial)
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

