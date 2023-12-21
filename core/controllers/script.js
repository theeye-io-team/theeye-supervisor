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

  /**
  @todo deprecated
  **/
module.exports = function (server) {
  server.get('/:customer/script',
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    controller.fetch
  )

  server.get('/:customer/script/:script', 
    server.auth.bearerMiddleware,
    router.requireCredential('viewer'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.resolve.idToEntity({param:'script',required:true,entity:'file'}),
    controller.get
  )

  // clients can download scripts
  //server.get('/:customer/script/:script/download',
  //  server.auth.bearerMiddleware,
  //  router.requireCredential('user'),
  //  router.resolve.customerNameToEntity({required:true}),
  //  router.ensureCustomer,
  //  router.resolve.idToEntity({param:'script',required:true,entity:'file'}),
  //  controller.download
  //)
}

const controller = {
  /**
  @todo deprecated
  **/
  fetch (req, res, next) {
    var customer = req.customer;
    var input = req.query;
    var filter = dbFilter(input,{ sort: { filename: 1 } });
    filter.where.customer_id = customer.id;

    Script.fetchBy(filter, (error, scripts) => {
      res.send(200, scripts)
      next()
    });
  },
  /**
  @todo deprecated
  **/
  get (req, res, next) {
    res.send(200, req.script)
    next()
  },
  /**
  @todo deprecated
  **/
  //download (req, res, next) {
  //  var script = req.script;

  //  ScriptService.getScriptStream(script, (err,stream) => {
  //    if (err) {
  //      logger.error(err.message)
  //      res.send(500)
  //    } else {
  //      logger.log('streaming script to client');

  //      var headers = {
  //        'Content-Disposition':'attachment; filename=' + script.filename,
  //      }
  //      res.writeHead(200,headers);
  //      stream.pipe(res);
  //      next()
  //    }
  //  })
  //}
}
