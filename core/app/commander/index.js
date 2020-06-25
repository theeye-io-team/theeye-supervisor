const restify = require('restify')
const logger = require('../../lib/logger')(':app:commander')
const agentsUpdate = require('./agentsUpdate')
const debugSetup = require('./debugSetup')

module.exports = function () {
  if (process.env.COMMANDER_DISABLED === 'true') {
    logger.log('WARNING! App Commander service is disabled via process.env')
    return
  }

  const server = restify.createServer({ strictNext: true })
  let plugins = restify.plugins
  server.use(plugins.acceptParser(server.acceptable))
  server.use(plugins.gzipResponse())
  server.use(plugins.bodyParser())
  server.use(plugins.queryParser())
  server.on('uncaughtException', (req, res, route, error) => {
    logger.error('Message Error: %s', error.message)
    logger.error('Stack %s', error.stack)
    res.send(500, error)
  })

  routes(server)

  server.listen(6666, () => {
    logger.log('TheEye Commander started. Listening at "%s"', server.url)
  })
}

const routes = (server) => {
  debugSetup(server)
  agentsUpdate(server)
}
