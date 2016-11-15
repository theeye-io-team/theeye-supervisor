'use strict';

const path = require('path');
const mime = require('mime');
const fs = require('fs');
var json = require('../lib/jsonresponse');
var debug = require('../lib/logger')('controller:script');
var router = require('../router');

var ScriptService = require('../service/script');
var ResourceService = require('../service/resource');
var Script = require('../entity/script').Entity;
var extend = require('util')._extend;

var filenameRegexp = /^[0-9a-zA-Z-_.]*$/;

function isValidFilename (filename) {
  if (!filename) return false;
  return filenameRegexp.test(filename);
}

module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
  ];

  server.get('/:customer/script',middlewares,controller.fetch);
  server.post('/:customer/script',middlewares,controller.create);

  var mws = middlewares.concat(
    router.resolve.idToEntity({param:'script',required:true})
  );
  server.get('/:customer/script/:script',mws,controller.get);
  server.patch('/:customer/script/:script',mws,controller.update);
  server.del('/:customer/script/:script',mws,controller.remove);
}

var controller = {
  /**
   *
   *
   */
  fetch : function (req, res, next) {

    ScriptService.fetchBy({
      customer_name: req.customer.name,
    }, function(scripts){
      if (!scripts) scripts = [];
      res.send(200, { scripts : scripts });
    });

    next();
  },
  /**
   *
   *
   */
  get : function (req, res, next) {
    var script = req.script;

    script.publish(function(error, data){
      res.send(200, { 'script' : data });
    });
    next();
  },
  /**
   *
   *
   */
  create : function (req, res, next) {

    var script = req.files.script;
    if (!isValidFilename(script.name)) {
      return res.send(400,json.error('invalid filename', script.name));
    }

    var description = req.body.description;
    var name = req.body.name;
    debug.log('creating script');

    ScriptService.create({
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
    });
    next();
  },
  /**
   *
   *
   */
  remove : function (req, res, next) {
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
   *
   */
  update: function(req, res, next) {
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
  }
};
