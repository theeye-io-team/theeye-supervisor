
/**
 *
 * Tasks:
 *
 * name
 * id
 * short_description
 * type
 * creator
 * rating
 * tags
 *
 * description
 *
 */
const App = require('../../app')
const router = require('../../router')
const dbFilter = require('../../lib/db-filter')
const logger = require('../../lib/logger')('controller:job')
const AsyncController = require('../../lib/async-controller')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (server) => {
  server.get('/marketplace/:model',
    server.auth.bearerMiddleware,
    AsyncController(fetch)
  )

  server.get('/marketplace/:model/:id',
    server.auth.bearerMiddleware,
    AsyncController(get)
  )

  server.post('/marketplace/:model/:id',
    server.auth.bearerMiddleware,
    AsyncController(rate)
  )
}

const get = async (req) => {
  const modelName = req.params.model
  const id = req.params.id

  const model = App.Models[modelName].Entity.findById(id)

  return model
}

const fetch = async (req) => {
}

const rate = async (req) => {
}
