var restify = require('restify');
var util = require('util');
var multer = require('multer');
var config =  require('config');

var router = require('./router');
var strategys = require('./lib/auth/strategys');
var logger = require('./lib/logger')('eye:supervisor:server');
var systemConfig = config.get('system');
var serverConfig = config.get('server');

function start() {
  var server = restify.createServer({ name : serverConfig.name });

  // Set the auth strategy
  passport = strategys.setStrategy( serverConfig.auth_strategy );

  server.pre(function (req,res,next) {
    logger.log('REQUEST %s %s', req.method, req.url);
    next();
  });

  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.gzipResponse());
  //server.use(restify.bodyParser());
  server.use(restify.queryParser());
  server.use(restify.jsonBodyParser());
  server.use(passport.initialize());
  server.use(multer({
    dest: systemConfig.file_upload_folder ,
    rename: function (fieldname, filename) {
      return filename;
    }
  }));
  server.use(function crossOrigin(req,res,next){
    res.header('Access-Control-Allow-Origin' , '*');
    res.header('Access-Control-Allow-Methods', '*');
    return next();
  });

  server.on('uncaughtException',function(req,res,route,error){
    logger.error('Message Error: %s', error.message);
    logger.error('Stack %s', error.stack);
    res.send(500,'internal error');
  });

  // Routing the controllers
  router.loadControllers(server, passport);

  server.listen( serverConfig.port, function() {
    logger.error('server started. "%s" listening at "%s"', server.name, server.url);
  });
}

exports.start = start;
