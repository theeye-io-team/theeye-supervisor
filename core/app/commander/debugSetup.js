const logger = require('../../lib/logger')('settings')

const debugSetup = (server) => {
  const debug = '/debug'

  server.put(debug, (req, res, next) => {
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

module.exports = debugSetup
