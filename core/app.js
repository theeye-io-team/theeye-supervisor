"use strict"

const restify = require('restify')
const util = require('util')
const multer = require('multer')
const config =  require('config')
const router = require('./router')
const auth = require('./lib/auth')
const logger = require('./lib/logger')('app')

const User = require('./entity/user').Entity

const App = {
  initialize (done) {
    getApplicationUser((error,user) => {
      if (error) {
        logger.error('cannot initialize application user')
        throw error
      }

      App.user = user
      logger.log('apps is ready')
      done()
    })
  },
  start () {
    const server = restify.createServer();
    const passport = auth.initialize();

    server.pre((req, res, next) => {
      logger.log('REQUEST %s %s', req.method, req.url)
      next()
    })

    server.pre((req, res, next) => { // CORS
      res.header('Access-Control-Allow-Origin' , '*')
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
        if (next) next()
      }
      next()
    })

    server.use(restify.acceptParser(server.acceptable))
    server.use(restify.gzipResponse())
    server.use(restify.queryParser())
    server.use(restify.jsonBodyParser())
    server.use(passport.initialize())
    server.use(multer({
      dest: config.system.file_upload_folder ,
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
}

const getApplicationUser = (next) => {
  User.findOne(config.system.user, (err, user) => {
    if (err) return next(err)
    if (!user) {
      // system user not found. create one
      let user = new User(config.system.user)
      user.save( err => {
        if (err) return next(err)
        next(null, user)
      })
    } else {
      next(null, user)
    }
  })
}

module.exports = App
