'use strict';

var router = require('../router');
var logger = require('../lib/logger')('eye:controller:webhook');
var audit = require('../lib/audit');
var dbFilter = require('../lib/db-filter');

var File = require('../entity/file').File;
var FileHandler = require('../lib/file');


const filenameRegexp = /^[0-9a-zA-Z-_.]*$/;
function isValidFilename (filename) {
  if (!filename) return false;
  return filenameRegexp.test(filename);
}


module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ];

  // FETCH
  server.get('/:customer/file', middlewares, controller.fetch);

  // GET
  server.get(
    '/:customer/file/:file',
    middlewares.concat(
      router.resolve.idToEntity({ param:'file', required:true })
    ),
    controller.get
  );

  // CREATE
  server.post(
    '/:customer/file',
    middlewares.concat( router.requireCredential('admin') ),
    controller.create
  );

  // UPDATE
  server.put(
    '/:customer/file/:file',
    middlewares.concat(
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param:'file', required: true })
    ),
    controller.update
  );

  // DELETE
  server.del(
    '/:customer/file/:file',
    middlewares.concat(
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param:'file', required: true })
    ),
    controller.remove
  );

  // users can download scripts
  server.get(
    '/:customer/file/:file/download',
    [
      passport.authenticate('bearer', {session:false}),
      router.requireCredential('user'),
      router.resolve.customerNameToEntity({required:true}),
      router.ensureCustomer,
      router.resolve.idToEntity({param:'script',required:true})
    ],
    controller.download
  );
}

var controller = {
  /**
   *
   * @method GET
   *
   */
  fetch (req, res, next) {
    var customer = req.customer;
    var query = req.query;

    var filter = dbFilter(query,{
      sort: { description: 1 }
    });
    filter.where.customer_id = customer.id;

    File.fetchBy(filter, function(error,files){
      if (!files) files = [];
      res.send(200,files);
      next();
    });
  },
  /**
   *
   * @method GET
   *
   */
  get (req, res, next) {
    req.file.publish(function(error,file){
      res.send(200,file);
      next();
    });
  },
  /**
   *
   * @method POST
   *
   */
  create (req, res, next) {
    var file = req.files.file,
      description = req.body.description,
      name = req.body.name;

    if (!isValidFilename(file.name)) {
      return res.send(400,json.error('invalid filename',file.name));
    }

    debug.log('creating file');

    FileHandler.create({
      customer: req.customer,
      user: req.user,
      description: description,
      name: name,
      public: (req.body.public||false),
      script: script,
    },function(error,script){
      if(error) {
        debug.error(error);
        res.send(500, json.error('internal server error',{
          error: error.message
        }) );
      } else {
        script.publish(function(error, data){
          res.send( 200, data );
        });
      }
      next();
    });
  },
  /**
   *
   * @method DELETE
   *
   */
  remove (req, res, next) {
    var script = req.script;

    ScriptService.remove({
      script: script,
      user: req.user,
      customer: req.customer
    },function(error,data){
      if(error) {
        debug.error(error);
        return res.send(500);
      }

      ResourceService.onScriptRemoved(script);
      res.send(204);
    });
  },
  /**
   *
   * @method PUT
   *
   */
  update (req, res, next) {
    var script = req.script;
    var file = req.files.script;
    var params = req.body;

    if (!file) {
      return res.send(400,'script file is required');
    }

    var input = extend(params,{
      customer: req.customer,
      user: req.user,
      script: script,
      file: file
    });

    ScriptService.update(input,(error, script) => {
      if(error) return res.send(500);
      ResourceService.onScriptUpdated(script);
      script.publish(function(error, data){
        res.send(200,{ 'script': data });
      });
    });
  },
  /**
   *
   * @method GET
   *
   */
  download (req, res, next) {
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
