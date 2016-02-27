var debug = require('../lib/logger')('eye:supervisor:controller:user');
var json = require('../lib/jsonresponse');
var strategys = require('../lib/auth/strategys');
var token = require('../lib/auth/token');
var UserService = require('../service/user');
var User = require("../entity/user").Entity;

var resolve = require('../router/param-resolver');
var filter = require('../router/param-filter');
var validate = require('../router/param-validator');

module.exports = function(server, passport)
{
  /**
   * use basic authentication to obtain a new token
   */
  var passport = strategys.setStrategy('basic');
  server.post('/token', [
    passport.authenticate('basic', { session: false })
  ], controller.token);

  server.get('/user/:user',[
    passport.authenticate('bearer', {session:false}),
    function(req,res,next){
      req.auth = {user : req.user};
      return next();
    },
    resolve.idToEntity({param:'user'})
  ], controller.get);

  server.get('/user',[
    passport.authenticate('bearer', {session:false}),
    resolve.customerNameToEntity({param:'customer'})
  ], controller.fetch);

  server.del('/user/:user',[
    passport.authenticate('bearer', {session:false}),
    resolve.idToEntity({ param:'user' })
  ], controller.remove);

  server.patch('/user/:user',[
    passport.authenticate('bearer', {session:false}),
    function(req,res,next){
      req.auth = {user : req.user};
      return next();
    },
    resolve.idToEntity({param:'user'}),
    filter.spawn({param:'customers', filter:'toArray'}),
    filter.spawn({param:'customers', filter:'uniq'}),
  ], controller.patch);

  server.post('/user',[
    passport.authenticate('bearer', {session:false}),
    filter.spawn({param:'customers', filter:'toArray'}),
    filter.spawn({param:'customers', filter:'uniq'}),
  ], controller.create);
}


/**
 *
 * middleware interface defined
 *
 */
function UserInterface (req, next)
{
  var errors = [];
  var values = [];

  /** email **/
  if(!req.params.email)
    errors.push({'param':'email','message':'required'});
  else if(!validate.isEmail(req.params.email))
    errors.push({'param':'email','message':'invalid'});
  else
   values.push({'param':'email','value':req.params.email});

  /** credential **/
  if(!req.params.credential)
    errors.push({'param':'credential','message':'required'});
  else
    values.push({'param':'credential','value':req.params.credential});

  /** customers **/
  var customers = req.customers;
  if(!customers || customers.length == 0)
    errors.push({param:'customers', message:'at least one required'});
  //else if(!isValidCustomersArray(customers))
  //  errors.push({param:'customers', message:'invalid'});
  else
    values.push({'param':'customers','value':customers});

  /** enabled **/
  if(typeof req.params.enabled != 'undefined')
    values.push({'param':'enabled','value':req.params.enabled});
  /** client_id **/
  if(req.params.client_id)
    values.push({'param':'client_id','value':req.params.client_id});

  /** client_secret **/
  if(req.params.client_secret)
    values.push({'param':'client_secret','value':req.params.client_secret});


  return {
    'errors': errors, 
    'values': values,
    'valueObject': function() {
      var output = {};
      for(var i=0; i<values.length; i++)
        output[ values[i].param ] = values[i].value;
      return output;
    }
  };
}

var controller = {
  get : function(req,res,next)
  {
    var user = req.user;
    if(!user) return res.send(404,json.error('user not found'));
    user.publish({ populateCustomers:true },function(error, data){
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
  patch : function(req, res, next)
  {
    var user = req.user; // user parameter to patch
    if(!user) return res.send(404, json.error('user not found'));

    var params = new UserInterface(req,next);
    var updates = params.valueObject();

    if(params.values.length === 0) 
      return res.send(400, json.error('nothing to update'));

    UserService.update(user._id, updates, function(error, user){
      if(error) {
        if(error.statusCode) 
          return res.send(error.statusCode, error.message);

        else {
          debug.error(error);
          return res.send(500,'internal error');
        }
      } else {
        user.publish({ 
          populateCustomers : true 
        }, function(error, data){
          res.send(200, { 'user' : data });
        });
      }
    });
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
  create : function(req,res,next)
  {
    var params = new UserInterface(req,next);

    if(params.errors.length != 0)
      return res.send(400, json.error('invalid request',params.errors));

    var values = params.valueObject();
    UserService.create(values, function(error,user){
      if(error) {
        debug.log('Error creating user');
        debug.log(error);
        res.send(500, json.error('failed to create user'));
      } else {
        debug.log('new user created');
        return user.publish({
          populateCustomers : true,
          publishSecret : true
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
  fetch : function(req,res,next)
  {
    var customer = req.customer;
    var credential = req.params.credential;

    var query = {};
    if( customer ) query['customer_id'] = customer.id ;
    if( credential ) query.credential = credential ;

    UserService.findBy(query, function(error,users) {
      if(error) {
        debug.error('error fetching users');
        res.send(500, json.error('failed to fetch users'));
      } else {
        debug.log('users fetched');

        var pub = [];
        for(var u=0; u<users.length; u++) {
          var user = users[u];

          var options = ( credential && credential == 'agent' ) ?
            { publishSecret : true } : {} ;

          var data = user.publish(options, function(error,data){ 
            // hook here to have populated customers
          });
          pub.push( data );
        }

        return res.send(200, { 'users' : pub });
      }
    });
  },
  /**
   * User basic authentication (user & passwd) to
   * obtain a new bearer authentication token.
   */
  token : function (req, res, next) {
    var user = req.user ;

    token.create(
      user.client_id, 
      user.client_secret, 
      function(error, data) {
        if(error) return res.send(400, 'Error');
        else {
          debug.log('creating new token');
          user.update({
            'token': data.token, 
            'timestamp': data.timestamp
          }, function(error) {
            if(error) throw new Error('user token update fails');
            else res.send(200, data.token);
          });
        }
      });

    return next;
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
      if(error) return res.send(500);
      res.send(204);
    });
  }
};
