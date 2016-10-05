var debug = require('debug')('eye:router:middleware:params-resolver');
var Host = require('../entity/host').Entity;
var User = require('../entity/user').Entity;
var Customer = require('../entity/customer').Entity;

module.exports = {
  'idToEntity': idToEntity,
  'hostnameToHost': hostnameToHost,
  'customerNameToEntity': customerNameToEntity
};

function firstToUpper(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function idToEntity (options) {

  if( ! options.param ) {
    throw new Error('param name is required!');
  }

  var paramName = options.param;
  var entityName = options.entity || options.param;

  return function (req, res, next) {
    var _id = req.params[paramName] ||
      req.body[paramName] ||
      req.query[paramName];

    if( ! _id ) {
      if( options.required ){
        var e = new Error(options.param + ' is required');
        e.statusCode = 400;
        return next(e);
      }

      debug('no param "%s"', paramName);
      req[paramName] = null;
      return next();
    }

    if( ! validMongoId(_id) ) {
      if( options.required ){
        var e = new Error(options.param + ' id is invalid');
        e.statusCode = 400;
        return next(e);
      }

      req[paramName] = null;
      return next();
    }

    debug('resolving "%s" with id "%s"', paramName, _id);

    var entityModule = require('../entity/' + entityName);
    var Entity = (
      entityModule.Entity || 
      entityModule[ firstToUpper(entityName) ] || 
      entityModule
    );

    Entity.findById( _id, (err, resource) => {
      if(err) {
        debug(err);
        req[paramName] = null;
        return next(err);
      }

      if( ! resource ) {

        if( options.required ){
          var e = new Error(options.param + ' not found');
          e.statusCode = 404;
          return next(e);
        }

        req[paramName] = null;
        return next();
      }

      debug('instances of "%s" found', options.param);
      req[paramName] = resource;
      next(null, resource);
    });
  }
}

function validMongoId (_id) {
  return _id.match(/^[a-fA-F0-9]{24}$/) ;
}

function hostnameToHost (options) {
  return function(req,res,next) {
    var hostname = req.params.hostname || req.body.hostname || req.query.hostname;
    var customer = req.customer;

    if(!customer) {
      debug('no customer');
      req.host = null;
      return next();
    }

    if(!hostname) {
      debug('no hostname');
      req.host = null;
      return next();
    }

    debug('resolving host with hostname "%s"', hostname);

    var query = {
      'hostname': hostname,
      'customer_name': customer.name
    };

    Host.findOne(query,function(err,host){
      if(err) {
        debug(err);
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
}

function customerNameToEntity (options) {
  return function(req,res,next) {
    var name = req.params.customer ||
      req.body.customer ||
      req.query.customer;

    if(!name) {
      if( options.required ){
        var error = new Error('organization is required') ;
        error.statusCode = 403;
        return next(error);
      }

      debug('no customer');
      req.customer = null;
      return next();
    }

    debug('resolving customer with name "%s"', name);

    var query = { name : name };
    Customer.findOne(query, (err, customer) => {
      if(err) {
        debug(err);
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
}
