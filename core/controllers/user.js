'use strict';

var isEmail = require('validator/lib/isEmail')
var logger = require('../lib/logger')('controller:user');
var json = require('../lib/jsonresponse');
var UserService = require('../service/user');
var User = require("../entity/user").Entity;

var router = require('../router');
var dbFilter = require('../lib/db-filter');
var ACL = require('../lib/acl');
var lodash = require('lodash');

module.exports = function (server, passport) {
  /**
   *
   * crud operations
   *
   */
  server.get('/user/:user',[
    passport.authenticate('bearer', { session: false }),
    router.requireCredential('root'),
    router.resolve.idToEntity({param:'user'})
  ], controller.get);

  server.get('/user',[
    passport.authenticate('bearer', { session: false }),
    router.requireCredential('root'),
    router.resolve.customerNameToEntity({ param: 'customer'})
  ], controller.fetch);

  server.get('/:customer/user',[
    passport.authenticate('bearer', {session: false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({ param: 'customer', required: true }),
    router.ensureCustomer,
  ], controller.fetch);

  server.del('/user/:user',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('root'),
    router.resolve.idToEntity({ param:'user' })
  ], controller.remove);

  server.patch('/user/:user',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('root'),
    router.resolve.idToEntity({param:'user', required: true }),
    router.filter.spawn({param:'customers', filter:'toArray'}),
    router.filter.spawn({param:'customers', filter:'uniq'}),
  ], controller.patch);

  server.post('/user',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('root'),
    router.filter.spawn({param:'customers', filter:'toArray'}),
    router.filter.spawn({param:'customers', filter:'uniq'}),
  ], controller.create);
}


/**
 *
 * middleware interface defined
 *
 */
function UserInterface (req, next) {
  var errors = [];
  var values = [];

  let input = req.body

  /** email **/
  if (!input.email) {
    errors.push({'param':'email','message':'required'});
  } else if (!isEmail(input.email)) {
    errors.push({'param':'email','message':'invalid'});
  } else {
   values.push({'param':'email','value':input.email});
  }

  /** username **/
  if (input.username) {
    values.push({'param':'username','value':input.username});
  }

  /** credential **/
  if (!input.credential) {
    errors.push({'param':'credential','message':'required'});
  } else {
    values.push({'param':'credential','value':input.credential});
  }

  /** customers **/
  var customers = req.customers;
  if (!customers || customers.length == 0) {
    errors.push({param:'customers', message:'at least one required'});
  //else if(!isValidCustomersArray(customers))
  //  errors.push({param:'customers', message:'invalid'});
  } else {
    values.push({'param':'customers','value':customers});
  }

  /** enabled **/
  if (typeof input.enabled != 'undefined') {
    values.push({'param':'enabled','value':input.enabled});
  }
  /** client_id **/
  if (input.client_id) {
    values.push({'param':'client_id','value':input.client_id});
  }

  /** client_secret **/
  if (input.client_secret) {
    values.push({'param':'client_secret','value':input.client_secret});
  }

  return {
    errors: errors,
    values: values,
    valueObject: function () {
      var output = {};
      for(var i=0; i<values.length; i++)
        output[ values[i].param ] = values[i].value;
      return output;
    }
  };
}

var controller = {
  get : function(req,res,next) {
    var user = req.user;
    if(!user) return res.send(404,json.error('user not found'));
    user.publish({ include_customers:true },function(error, data){
      res.send(200, { user: data });
    });
  },
  /**
   * Partially Update user attributes
   *
   * @author Facundo
   * @param {String} client_id
   * @param {String} client_secret
   * @param {String} email
   * @param {String} credential
   * @param {String} enabled
   *
   */
  patch (req, res, next) {
    const user = req.user; // user parameter to patch
    if (!user) {
      return res.send(404, json.error('user not found'))
    }

    var input = new UserInterface(req, next)
    var updates = input.valueObject()

    //if (updates.email !== user.email) {
    //  return res.send(403,'user email can\'t be changed');
    //}

    if (input.values.length === 0) {
      return res.send(400, json.error('no changes'))
    }

    UserService.update(user._id, updates, (err, user) => {
      if (err) {
        logger.error('%o', err)
        return res.send(err.statusCode || 500, err.message)
      }

      user.publish({ include_customers: true }, (error, data) => {
        res.send(200, { user: data })
      })
    })
  },
  /**
   * Register a new user.
   *
   * @author Facundo
   * @param {String} email (required)
   * @param {Array}  customers (at least one required)
   * @param {String} credential (required)
   * @param {String} client_id
   * @param {String} client_secret
   * @param {String} enabled (false by default)
   *
   */
  create (req,res,next) {
    var input = new UserInterface(req, next)

    if (input.errors.length != 0) {
      return res.send(400, json.error('invalid request',input.errors))
    }

    var values = input.valueObject()
    UserService.create(values, function(error,user){
      if(error) {
        logger.log('Error creating user');
        logger.log(error);
        res.send(500, json.error('failed to create user'));
      } else {
        logger.log('new user created');
        return user.publish({
          include_customers: true,
          include_token: true,
        }, function(error, data){
          res.send(200, { user: data });
        });
      }
    });
  },
  /**
   *
   *
   */
  fetch (req,res,next) {
    var filter = dbFilter(req.query,{ /** default **/ });

    // find only what this user can access
    if ( !ACL.hasAccessLevel(req.user.credential,'root')||req.customer ) {
      filter.where['customers._id'] = req.customer._id;
    }

    User.fetchBy(filter,function (error,users) {
      if (error) {
        logger.error('error fetching users');
        return res.send(500,error.message);
      }

      if (users.length===0) return res.send(200,[]);

      var pub = [];
      var end = lodash.after(users.length,() => res.send(200,pub));
      users.forEach(user => {
        var options = {
          include_secret:(filter.where.credential=='agent'),
          include_token:(filter.where.credential=='agent'),
        };
        user.publish(options,(error,data) => {
          pub.push(data);
          end();
        });
      });
    });
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   * @route /user/:user
   *
   */
  remove : function (req, res, next) {
    var user = req.user;

    if(!user) return res.send(404);

    user.remove(function(error){
      if(error) return res.send(500, error);
      res.send(204);
    });
  }
}
