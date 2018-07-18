'use strict';

const mime = require('mime');
const fs = require('fs');
const extend = require('util')._extend;
const audit = require('../lib/audit')
const logger = require('../lib/logger')('controller:script')

var json = require('../lib/jsonresponse')
var router = require('../router')
var ScriptService = require('../service/script')
var ResourceService = require('../service/resource')
var Script = require('../entity/file').Script
var dbFilter = require('../lib/db-filter')

//const filenameRegexp = /^[0-9a-zA-Z-_.]*$/
//function isValidFilename (filename) {
//  if (!filename) {
//    return false
//  }
//  return filenameRegexp.test(filename)
//}

module.exports = function(server, passport){
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ]

  server.get('/:customer/script' , [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ] , controller.fetch)

  //server.post(
  //  '/:customer/script',
  //  middlewares,
  //  controller.create,
  //  audit.afterCreate('script',{ display: 'filename' })
  //)

  var mws = middlewares.concat(
    router.resolve.idToEntity({param:'script',required:true,entity:'file'})
  )

  server.get('/:customer/script/:script', [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'script',required:true,entity:'file'})
  ] , controller.get)

  //server.patch(
  //  '/:customer/script/:script',
  //  mws,
  //  controller.patch,
  //  audit.afterUpdate('script',{ display: 'filename' })
  //)

  //server.del(
  //  '/:customer/script/:script',
  //  mws,
  //  controller.remove,
  //  audit.afterRemove('script',{ display: 'filename' })
  //)

  // clients can download scripts
	server.get(
    '/:customer/script/:script/download',[
      passport.authenticate('bearer', {session:false}),
      router.requireCredential('user'),
      router.resolve.customerNameToEntity({required:true}),
      router.ensureCustomer,
      router.resolve.idToEntity({param:'script',required:true,entity:'file'})
    ],
    controller.download
  )
}

const controller = {
  /**
   *
   *
   */
  fetch (req, res, next) {
    var customer = req.customer;
    var input = req.query;
    var filter = dbFilter(input,{ sort: { filename: 1 } });
    filter.where.customer_id = customer.id;

    Script.fetchBy(filter, function(error,scripts){
      if (!scripts) scripts = [];
      res.send(200, scripts);
      next();
    });
  },
  /**
   *
   *
   */
  get (req, res, next) {
    var script = req.script
    script.publish(function(error, data){
      res.send(200, data)
    })
    next()
  },
  /**
   *
   *
   */
  //create (req, res, next) {
  //  var script = req.files.script;
  //  if (!isValidFilename(script.name)) {
  //    return res.send(400,json.error('invalid filename', script.name));
  //  }

  //  var description = req.body.description;
  //  var name = req.body.name;
  //  logger.log('creating script');

  //  ScriptService.create({
  //    customer: req.customer,
  //    user: req.user,
  //    description: description,
  //    name: name,
  //    public: (req.body.public||false),
  //    script: script,
  //  },function(err,script){
  //    if (err) {
  //      logger.error(err)
  //      res.send(500)
  //    } else {
  //      script.publish((error, data) => {
  //        res.send(200, data)
  //        req.script = data
  //        next()
  //      })
  //    }
  //  })
  //},
  /**
   *
   *
   */
  //remove (req, res, next) {
  //  const script = req.script

  //  ScriptService.remove({
  //    script: script,
  //    user: req.user,
  //    customer: req.customer
  //  },function(err,data){
  //    if (err) {
  //      logger.error(err)
  //      return res.send(500)
  //    }

  //    ResourceService.onScriptRemoved(script)
  //    res.send(204)
  //    next()
  //  })
  //},
  /**
   *
   * @method PATCH
   *
   */
  //patch (req, res, next) {
  //  const script = req.script
  //  const file = req.files.script
  //  const params = req.body

  //  if (!file) {
  //    return res.send(400,'script file is required')
  //  }

  //  delete params.customer
  //  delete params.customer_id
  //  delete params.user
  //  delete params.user_id

  //  var input = extend(params,{
  //    //customer_id: req.customer._id,
  //    //customer: req.customer,
  //    //user: req.user,
  //    script: script,
  //    file: file
  //  })

  //  ScriptService.update(input,(err, script) => {
  //    if (err) {
  //      logger.error(err)
  //      return res.send(500)
  //    }
  //    ResourceService.onScriptUpdated(script)
  //    script.publish((err, data) => {
  //      if (err) {
  //        logger.error(err)
  //        return res.send(500)
  //      }

  //      res.send(200, data)
  //      next()
  //    })
  //  })
  //},
  download (req, res, next) {
    var script = req.script;

    ScriptService.getScriptStream(script, (err,stream) => {
      if (err) {
        logger.error(err.message)
        res.send(500)
      } else {
        logger.log('streaming script to client');

        var headers = {
          'Content-Disposition':'attachment; filename=' + script.filename,
        }
        res.writeHead(200,headers);
        stream.pipe(res);
        next()
      }
    })
  }
}
