var fs = require('fs');
var Script = require('../entity/script').Entity;
var ScriptService = require('../service/script');
var json = require("../lib/jsonresponse");
var debug = require('../lib/logger')('controller:script-download');
var resolve = require('../router/param-resolver');

module.exports = function(server, passport){
	server.get('/:customer/script/:id/download',[
    passport.authenticate('bearer', {session:false}),
    resolve.customerNameToEntity({})
  ],controller.get);

	server.get('/script/:id/download',[
    passport.authenticate('bearer', {session:false}),
    resolve.customerNameToEntity({})
  ],controller.get);
}

var controller = {
  get: function (req, res, next) {
    var id = req.params.id;

    Script.findById(id, function(error,script){
      if(!script) {
        res.send(404, json.error('not found'));
      } else {
        ScriptService.getScriptStream(
          script,
          function(error,stream)
          {
            if(error) {
              debug.error(error.message);
              res.send(500, json.error('internal error',null));
            } else {
              debug.log('streaming script to client');
              res.writeHead(200,{
                'Content-Disposition': 'attachment; filename=' + script.filename,
                // don't add this headers because if server use gzip 
                // content type and length should be calculated accordingly
                // this is only for documentation purpose
                //
                //'Content-Length' : script.size,
                //'Content-Type' : script.mimetype
              });
              stream.pipe(res);
            }
          }
        );
      }
    });
    next();
  }
};
