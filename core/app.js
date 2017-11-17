"use strict"

const restify = require('restify')
const util = require('util')
const multer = require('multer')
const config =  require('config')
const router = require('./router')
const auth = require('./lib/auth')
const logger = require('./lib/logger')('app')

const App = {
  start () {
    const server = restify.createServer();
    const passport = auth.initialize();

    server.pre( (req,res,next) => {
      logger.log('REQUEST %s %s', req.method, req.url)
      next()
    })

    // respond with error middleware
    server.use((req,res,next) => {
      res.sendError = (err,next) => {
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
        return filename;
      }
    }));

    server.use((req,res,next) => { // CORS
      res.header('Access-Control-Allow-Origin' , '*');
      res.header('Access-Control-Allow-Methods', '*');
      return next();
    });

    server.on('uncaughtException', (req,res,route,error) => {
      logger.error('Message Error: %s', error.message);
      logger.error('Stack %s', error.stack);
      res.send(500,'internal error');
    });

    // Routing the controllers
    router.loadControllers(server, passport);

    server.listen( config.server.port || 60080, () => {
      logger.log('TheEye server started. listening at "%s"', server.url);
    });
  }
}

module.exports = App
