const restify = require('restify')
const multer = require('multer')
const config = require('config')
const router = require('../router')
const auth = require('../lib/auth')
const logger = require('../lib/logger')('app:server')

module.exports = function () {
  const server = restify.createServer({ strictNext: true })
  const passport = auth.initialize()

  server.pre((req, res, next) => {
    logger.log('REQUEST %s %s', req.method, req.url)
    next()
  })

  server.pre((req, res, next) => { // CORS
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS')
    let headers = [
      'Origin',
      'Accept',
      'User-Agent',
      'Accept-Charset',
      'Cache-Control',
      'Accept-Encoding',
      'Content-Type',
      'Authorization',
      'Content-Length',
      'X-Requested-With'
    ]
    res.header("Access-Control-Allow-Headers", headers.join(', '))
    //intercepts OPTIONS method
    if ('options' === req.method.toLowerCase()) {
      //respond with 200
      res.send(200)
    } else {
      //move on
      next()
    }
  })

  // respond with error middleware
  server.use((req, res, next) => {
    res.sendError = (err, next) => {
      const status = err.statusCode || 500
      res.send(status, {
        statusCode: status,
        message: err.message,
        errors: err.errors
      })
      if (next) { next() }
    }
    next()
  })

  let plugins = restify.plugins
  server.use(plugins.acceptParser(server.acceptable))
  server.use(plugins.gzipResponse())
  server.use(plugins.queryParser())
  //server.use(plugins.jsonBodyParser())
  server.use(plugins.bodyParser())
  server.use(passport.initialize())
  server.use(multer({
    dest: config.system.file_upload_folder,
    rename: (fieldname, filename) => {
      return filename
    }
  }))

  server.on('uncaughtException', (req, res, route, error) => {
    logger.error('Message Error: %s', error.message)
    logger.error('Stack %s', error.stack)
    res.send(500, 'internal error')
  })

  // Routing the controllers
  router.loadControllers(server, passport)

  server.listen( config.server.port || 60080, () => {
    logger.log('TheEye server started. listening at "%s"', server.url)
  })
}
