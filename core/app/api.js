const restify = require('restify')
const config = require('config')
const router = require('../router')
const logger = require('../lib/logger')(':app:api')
const ErrorHandler = require('../lib/error-handler')

module.exports = function () {
  if (process.env.API_DISABLED === 'true') {
    logger.log('WARNING! App Api service is disabled via process.env')
    return
  }

  const server = restify.createServer({ strictNext: true })

  server.pre((req, res, next) => {
    logger.log('REQUEST %s %s %j', req.method, req.url, req.headers)
    next()
  })

  server.pre((req, res, next) => { // CORS
    let origin = (req.headers && (req.headers.origin||req.headers.Origin))
    //intercepts OPTIONS method
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
    } else {
      res.header('Access-Control-Allow-Origin', '*')
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Credentials', 'true')

    let headers = [
      'Accept',
      'Accept-Charset',
      'Accept-Encoding',
      'Accept-Version',
      'Authorization',
      'Cache-Control',
      'Content-Length',
      'Content-Type',
      'Origin',
      'User-Agent',
      'X-Requested-With'
    ]

    res.header("Access-Control-Allow-Headers", headers.join(', '))

    if ('options' === req.method.toLowerCase()) {
      //respond with 200
      res.send(204)
    } else {
      //move on
      next()
    }
  })

  // respond with error middleware
  server.use((req, res, next) => {
    res.sendError = (error, next) => {
      if (error.statusCode < 500) {
        res.send(error.statusCode || 400, {
          statusCode: error.statusCode,
          message: error.message,
          errors: error.errors
        })
      } else {
        const handler = new ErrorHandler()
        handler.sendExceptionAlert(error, req)
        res.send(500, 'Internal Server Error')
      }
      if (next) { next() }
    }
    next()
  })

  let plugins = restify.plugins
  server.acceptable = server.acceptable.concat(
    server.acceptable.map(accept => `${accept};charset=UTF-8`)
  )

  server.use(plugins.acceptParser(server.acceptable))
  server.use(plugins.gzipResponse())
  server.use(plugins.queryParser())
  server.use(plugins.bodyParser())
  //server.use(passport.initialize())

  server.on('uncaughtException', (req, res, route, error) => {
    const handler = new ErrorHandler()
    handler.sendExceptionAlert(error)
    logger.error('Message Error: %s', error.message)
    logger.error('Stack %s', error.stack)
    res.send(500, 'internal error')
  })

  // Routing the controllers
  router.loadControllers(server)

  const PORT = process.env.PORT || config.server.port || 60080

  server.listen(PORT, () => {
    logger.log('TheEye API started. Listening at "%s"', server.url)
  })
}
