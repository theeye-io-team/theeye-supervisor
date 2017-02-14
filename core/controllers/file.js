'use strict';

const fs = require('fs');
const md5 = require('md5');

var router = require('../router');
var logger = require('../lib/logger')('eye:controller:file');
var audit = require('../lib/audit');
var dbFilter = require('../lib/db-filter');
var File = require('../entity/file').File;
var FileHandler = require('../lib/file');

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
    controller.create,
    audit.afterCreate('file',{display:'filename'})
  );

  // UPDATE
  server.put(
    '/:customer/file/:file',
    middlewares.concat(
      router.requireCredential('admin'),
      router.resolve.idToEntity({ param:'file', required:true })
    ),
    controller.update,
    audit.afterUpdate('file',{display:'filename'})
  );

  // DELETE
  //server.del(
  //  '/:customer/file/:file',
  //  middlewares.concat(
  //    router.requireCredential('admin'),
  //    router.resolve.idToEntity({ param:'file', required:true })
  //  ),
  //  controller.remove,
  //  audit.afterRemove('file',{display:'filename'})
  //);

  // users can download scripts
  server.get(
    '/:customer/file/:file/download',
    [
      passport.authenticate('bearer', {session:false}),
      router.requireCredential('user'),
      router.resolve.customerNameToEntity({required:true}),
      router.ensureCustomer,
      router.resolve.idToEntity({param:'file',required:true})
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
      sort: { filename: 1 }
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
      if (error) return next(error);
      res.send(200,file);
    });
  },
  /**
   *
   * @method PUT
   *
   */
  update (req, res, next) {
    var source = req.files.file,
      user = req.user,
      //name = req.body.name,
      file = req.file,
      customer = req.customer,
      description = req.body.description,
      isPublic = (req.body.public||false);

    if (!source) return res.send(400,'file is required');

    FileHandler.replace({
      file: file,
      source: source,
      pathname: customer.name
    },function(err,storeData){
      if (err) {
        logger.error(err);
        return next(err);
      } else {

        var buf = fs.readFileSync(source.path);

        var data = {
          filename: source.name,
          mimetype: source.mimetype,
          extension: source.extension,
          size: source.size,
          description: description,
          user_id: user._id,
          keyname: storeData.keyname,
          md5: md5(buf),
          public: isPublic
        };

        file.update(data,err => {
          if (err) {
            logger.error(err);
            next(err);
          } else {
            file.publish((err,data) => {
              if (err) return next(err);
              res.send(200,data);
              next();
            });
          }
        })
      }
    });
  },
  /**
   *
   * @method POST
   *
   */
  create (req, res, next) {
    var user = req.user,
      //name = req.body.name,
      customer = req.customer,
      source = req.files.file,
      description = req.body.description,
      isPublic = (req.body.public||false);

    logger.log('creating file');

    FileHandler.store({
      source: source,
      pathname: req.customer.name
    }, function(err,storeData){
      if (err) {
        logger.error(err);
        return next(err);
      } else {

        var buf = fs.readFileSync(source.path);

        var data = {
          filename: source.name,
          mimetype: source.mimetype,
          extension: source.extension,
          size: source.size,
          description: description,
          customer: customer,
          customer_id: customer._id,
          customer_name: customer.name,
          user_id: user._id,
          keyname: storeData.keyname,
          md5: md5(buf),
          public: isPublic
        };

        File.create(data,(err,file) => {
          if (err) {
            logger.error(err);
            next(err);
          } else {
            file.publish((err,data) => {
              if (err) return next(err);

              req.file = file; // assign to the route to audit
              res.send(200,data);
              next();
            });
          }
        });
      }
    });
  },
  /**
   *
   * @method GET
   *
   */
  download (req, res, next) {
    var file = req.file;
    FileHandler.getStream(file,(error,stream) => {
      if (error) {
        logger.error(error);
        next(error);
      } else {
        logger.log('streaming file to client');
        var headers = { 'Content-Disposition':'attachment; filename=' + file.filename };
        res.writeHead(200,headers);
        stream.pipe(res);
      }
    });
  }
};
