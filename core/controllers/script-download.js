'use strict';

var fs = require('fs');
var Script = require('../entity/script').Entity;
var ScriptService = require('../service/script');
var json = require("../lib/jsonresponse");
var debug = require('../lib/logger')('controller:script-download');
var router = require('../router');

module.exports = function(server, passport){
	server.get('/:customer/script/:script/download',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('user'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'script',required:true})
  ],controller.get);

  /**
	server.get('/script/:id/download',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('user'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ],controller.get);
  */
}

var controller = {
  get (req, res, next) {
    var script = req.script;

    ScriptService.getScriptStream(script, (error,stream) => {
      if (error) {
        debug.error(error.message);
        res.send(500, json.error('internal error',null));
      } else {
        debug.log('streaming script to client');

        var headers = {
          'Content-Disposition':'attachment; filename=' + script.filename,
        }
        res.writeHead(200,headers);
        stream.pipe(res);
      }
    });

    next();
  }
};
