var debug = require('debug')('eye:supervisor:router:param-resolver-middleware');
var Host = require('../entity/host').Entity;
var User = require('../entity/user').Entity;
var Customer = require('../entity/customer').Entity;

module.exports = {
  'idToEntity': idToEntity,
  'hostnameToHost': hostnameToHost,
  'customerNameToEntity': customerNameToEntity
};

function idToEntity (options) {

  if(!options.param) throw new Error('param name is required!');

  var paramName = options.param;
  var entityName = options.entity || options.param;

  return function(req, res, next) {
    var _id = req.params[paramName] || req.body[paramName] || req.query[paramName];

    if(!_id) {
      debug('no param "%s"', paramName);
      req[paramName] = null;
      return next();
    }

    debug('resolving "%s" with id "%s"', paramName, _id);

    if( ! validMongoId(_id) ) {
      req[paramName] = null;
      next();
    } else {
      var Entity = require('../entity/' + entityName).Entity;
      Entity.findById(_id, function(queryError, resource){
        if(queryError) {
          debug(queryError);
          req[paramName] = null;
          next(queryError);
        } else if(resource == null) {
          req[paramName] = null;
          next();
        } else {
          debug('entity match found');
          req[paramName] = resource ;
          next();
        }
      });
    }
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

    Host.findOne(query,function(queryError,host){
      if(queryError) {
        debug(queryError);
        next(queryError);
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
    var name = req.params.customer || req.body.customer || req.query.customer;

    if(!name) {
      debug('no customer');
      req.customer = null;
      return next();
    }

    debug('resolving customer with name "%s"', name);

    var query = { name : name };
    Customer.findOne(query, function(queryError, customer){
      if(queryError) {
        debug(queryError);
        next(queryError);
      } else if(customer == null) {
        req.customer = null;
        next();
      } else {
        req.customer = customer ;
        next();
      }
    });
  }
}
