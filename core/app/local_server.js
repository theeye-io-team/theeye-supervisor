const restify = require('restify')
const logger = require('../lib/logger')('app:local_server')

module.exports = function () {
  const server = restify.createServer({ strictNext: true })
  let plugins = restify.plugins
  server.use(plugins.acceptParser(server.acceptable))
  server.use(plugins.jsonBodyParser())
  server.use(plugins.queryParser())
  server.on('uncaughtException', (req, res, route, error) => {
    logger.error('Message Error: %s', error.message)
    logger.error('Stack %s', error.stack)
    res.send(500, error)
  })

  routes(server)

  server.listen(6666, () => {
    logger.log('TheEye Local server started')
  })
}

const routes = (server) => {
  server.put('/debug', (req, res, next) => {
    let namespace = req.query.namespace
    if (!namespace) {
      logger.instance.disable()
      res.send(200, 'disabled')
      next()
    } else {
      logger.instance.enable(namespace)
      res.send(200, namespace)
      next()
    }
  })
}
