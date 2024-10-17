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

  let plugins = restify.plugins
  server.acceptable = server.acceptable.concat(
    server.acceptable.map(accept => `${accept};charset=UTF-8`)
  )

  server.use(plugins.acceptParser(server.acceptable))
  server.use(plugins.gzipResponse())
  server.use(plugins.queryParser())
  server.use(plugins.bodyParser())

  const sendError = (req, res) => {
    return (err) => {
      if (err.name == 'ValidationError') {
        res.send(400, err)
      } else if (err instanceof ErrorHandler.ClientError || err.statusCode < 500) {
        res.send(err.statusCode || 400, {
          statusCode: err.statusCode,
          message: err.message,
          errors: err.errors
        })
      } else {
        logger.error('Message Error: %s', err.message)
        logger.error('Stack %s', err.stack)

        const handler = new ErrorHandler()
        handler.sendExceptionAlert(err, req)

        res.send(500, 'Internal Server Error')
      }
      //if (next) { next() }
    }
  }

  // respond with error middleware
  server.use((req, res, next) => {
    // define middleware
    res.sendError = sendError(req, res, next)
    next()
  })

  server.on('uncaughtException', (req, res, route, error) => { sendError(req, res)(error) })
  server.on('restifyError', (req, res, error) => { sendError(req, res)(error) })

  // Routing the controllers
  router.load(server)

  const PORT = process.env.PORT || config.server.port || 60080

  server.listen(PORT, () => {
    logger.log('TheEye API started. Listening at "%s"', server.url)
  })
}
