var debug = require('../lib/logger')('service:user');
var User = require('../entity/user').Entity;
var Customer = require('../entity/customer').Entity;
var crypto = require('crypto');
var Schema  = require('mongoose').Schema;
var async = require('async');

/**
 *
 * convert an array of customer names into an array
 * of customer objects, with the required data to store
 * them into the user entity attribute "customers".
 *
 * @author Facundo
 * @param {Array} names
 * @param {Function} completedFn callback
 * @return null
 *
 */
function customerNamesToUserCustomers (names, completedFn) {
  if(!names||names.length==0) return completedFn(null,[]);

  function createCallFn (name) {
    return function (doneFn) {
      Customer.findOne({
        'name': name
      }, function(error, customer) {
        if(error) return doneFn(error);
        if(!customer) {
          debug.error('WARNING customer %s not found!', name);
          return doneFn();
        }
        else {
          var data = {
            '_id': customer._id,
            'name': customer.name,
            'customer': customer._id // to populate it later
          }
          doneFn(null,data);
        }
      });
    }
  }

  var calls = [];

  for(var i=0; i<names.length; i++){
    var name = names[i];
    calls.push( createCallFn(name) );
  }

  return async.parallel(calls, completedFn);
}

module.exports = {
  /**
   * @author Facundo
   * @param {Array} filters query
   * @return null
   */
  findBy : function(filters, next) {
    var query = {};

    for(var f in filters) {
      switch(f) {
        case 'customer_id': query['customers._id'] = filters['customer_id']; break;
        case 'customer_name': query['customers.name'] = filters['customer_name']; break;
        case 'credential': query[f] = filters[f]; break;
      }
    }

    debug.log('querying users by %j', query);

    User.find(query).exec(function(err, users) {
      if(err) return next(err);

      return next(null, users);
    });
  },
  /**
   *
   * @param {Object} user
   * @param {Object} updates
   * @return {Object} query result
   *
   */
  update (id, updates, next) {
    var customerNames = updates.customers;
    debug.log('updating user %s data', id);

    customerNamesToUserCustomers(
      customerNames,
      function(error, customers) {
        if(error) return next(error);

        User.findOne({ _id : id }, function (error, user) {
          if(error) return next(error);

          for (var attr in updates) {
            if(attr != 'customers'){
              user[attr] = updates[attr];
            } else {
              user['customers'] = customers;
            }
          }

          user.save(function(error){
            if(error) return next(error);
            next(null,user);
          });
        });
      }
    );
  },
  /**
   * creates a random hash
   * @author Facundo
   * @return {String} sha1 token
   */
  randomHash: function() {
    return crypto.randomBytes(20).toString('hex');
  },
  /**
   * @author Facundo
   * @param {Array} options
   * @param {Function} next callback
   * @return null
   */
  create (options, next) {
    var self = this;

    customerNamesToUserCustomers(
      options.customers,
      function (error, customers) {
        if(error) return next(error);

        var data = {
          client_id: (options.client_id||self.randomHash()),
          client_secret: (options.client_secret||self.randomHash()),
          token: self.randomHash(),
          email: options.email,
          customers: customers,
          credential: options.credential,
          enabled: options.enabled || false,
          username: options.username
        };

        var user = new User(data);
        user.save(function(err, user) {
          if(err) {
            return next(err);
          } else {
            return next(null, user);
          }
        });
      }
    );
  }
};
