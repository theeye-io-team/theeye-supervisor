'use strict';

var logger = require('../lib/logger')(':router:middleware:params-resolver');
var Host = require('../entity/host').Entity;
var User = require('../entity/user').Entity;
var Customer = require('../entity/customer').Entity;
var isMongoId = require('validator/lib/isMongoId')

function firstToUpper(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const isObject = (value) => {
  return Object.prototype.toString.call(value) == '[object Object]'
}

module.exports = {
  idToEntity (options) {
    options||(options={});

    if (!options.param) throw new Error('param name is required!');
    var paramName = options.param;
    var entityName = (options.entity||options.param);
    var targetName = (options.into||paramName);

    return function (req, res, next) {
      var _id = req.params[paramName]||req.body[paramName]||req.query[paramName];

      if (isObject(_id)) {
        _id = ( _id._id || _id.id || undefined )
      } else if (typeof _id !== 'string') {
        _id = undefined
      }

      if (!_id) {
        if (options.required) {
          var e = new Error(options.param + ' is required');
          e.statusCode = 400;
          return next(e);
        }

        logger.debug('no param "%s"', targetName);
        req[targetName] = null;
        return next();
      }

      if (!isMongoId(_id)) {
        if (options.required) {
          var e = new Error(options.param + ' id is invalid');
          e.statusCode = 400;
          return next(e);
        }

        req[targetName] = null;
        return next();
      }

      logger.debug('resolving "%s" with id "%s"', targetName, _id);

      var entityModule = require('../entity/' + entityName);
      var Entity = (
        entityModule.Entity || 
        entityModule[ firstToUpper(entityName) ] || 
        entityModule
      );

      Entity.findById( _id, (err, resource) => {
        if (err) {
          logger.error(err);
          req[targetName] = null;
          return next(err);
        }

        if (!resource) {
          if (options.required) {
            var e = new Error(options.param + ' not found');
            e.statusCode = 404;
            return next(e);
          }

          req[targetName] = null;
          return next();
        }

        logger.debug('instances of "%s" found', options.param);
        req[targetName] = resource;
        next(null, resource);
      })
    }
  },
  hostnameToHost (options) {
    options||(options={});

    return function (req,res,next) {
      var hostname = req.params.hostname||req.body.hostname||req.query.hostname;
      var customer = req.customer;

      if (!customer) {
        logger.debug('no customer yet present');
        req.host = null;
        return next();
      }

      if (!hostname) {
        if (options.required) {
          var e = new Error('hostname is required');
          e.statusCode = 400;
          return next(e);
        }

        logger.debug('no hostname');
        req.host = null;
        return next();
      }

      logger.debug('resolving host with hostname "%s"', hostname);

      Host.findOne({
        hostname: hostname,
        customer_name: customer.name
      },function(err,host){
        if(err) {
          logger.debug(err);
          next(err);
        } else if(host == null) {
          req.host = null ;
          return next();
        } else {
          req.host = host ;
          return next();
        }
      });
    }
  },
  customerNameToEntity (options) {
    options||(options={});

    return function (req,res,next) {
      var name = req.params.customer||req.body.customer||req.query.customer;

      if (!name) {
        if (options.required) {
          var error = new Error('organization is required');
          error.statusCode = 403;
          return next(error);
        }

        logger.debug('no customer');
        req.customer = null;
        return next();
      }

      logger.debug('resolving customer with name "%s"', name);

      var query = { name : name };
      Customer.findOne(query, (err, customer) => {
        if(err) {
          logger.error(err);
          return next(err);
        }

        if(!customer){
          if(options.required){
            var error = new Error('organization not found') ;
            error.statusCode = 403;
            return next(error);
          }

          req.customer = null;
          return next();
        }

        req.customer = customer ;
        next();
      });
    }
  },
}
