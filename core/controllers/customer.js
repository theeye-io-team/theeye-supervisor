var debug = require('../lib/logger')('eye:supervisor:controller:customer');
var json = require('../lib/jsonresponse');
var paramsResolver = require('../router/param-resolver');

var CustomerService = require('../service/customer');
var UserService = require('../service/user');
var ResourceService = require('../service/resource');
var HostService = require('../service/host');

module.exports = function(server, passport) 
{
  server.get('/customer',[
    passport.authenticate('bearer', {session:false}),
  ], controller.fetch);

  server.get('/customer/:customer',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'customer'})
  ], controller.get);

  server.post('/customer',[
    passport.authenticate('bearer', {session:false}),
  ], controller.create);

  server.patch('/customer/:customer',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'customer'})
  ], controller.update);

  server.put('/customer/:customer',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'customer'})
  ], controller.replace);

  server.del('/customer/:customer',[
    passport.authenticate('bearer', {session:false}),
    paramsResolver.idToEntity({param:'customer'})
  ], controller.remove);

  /**
  return {
    routes: [ {
        route: '/customer',
        method: 'get',
        middleware: [],
        action: controller.fetch
      }, {
        route: '/customer',
        method: 'post',
        middleware: [],
        action: controller.create
      }, {
        route: '/customer/:customer',
        method: 'get',
        middleware: [
          paramsResolver.idToEntity({param:'customer'})
        ],
        action: controller.get
      }, {
        route: '/customer/:customer',
        method: 'patch',
        middleware: [
          paramsResolver.idToEntity({param:'customer'})
        ],
        action: controller.update
      }, {
        route: '/customer/:customer',
        method: 'put',
        middleware: [
          paramsResolver.idToEntity({param:'customer'})
        ],
        action:  controller.replace
      }, {
        route: '/customer/:customer',
        method: 'del',
        middleware: [
          paramsResolver.idToEntity({param:'customer'})
        ],
        action: controller.remove
      }
    ]
  }
  */
}

var controller = {
  /**
   *
   */
  get : function(req,res,next)
  {
    var customer = req.customer;
    if(!customer) return res.send(404,json.error('not found'));
    res.send(200, {customer: customer.publish()});
  },
  /**
   *
   */
  fetch : function(req,res,next)
  {
    CustomerService.fetch({}, function(error,customers) {
      if(error) {
        debug.error('error fetching customers');
        res.send(500, json.error('failed to fetch customers'));
      } else {
        var published = [];
        for(var c=0;c<customers.length;c++)
          published.push( customers[c].publish() );
          
        return res.send(200, {'customers': published});
      }
    });
  },
  /**
   *
   */
  create : function(req,res,next)
  {
    var input = req.body;

    if(!input.name) return res.send(400, json.error('name is required'));
    if(!input.email) return res.send(400, json.error('email is required'));

    CustomerService.create(input, function(error,customer) {
      if(error) {
        if(error.code == 11000) { //duplicated
          res.send(400, json.error(input.name + ' customer already exists'));
        } else {
          debug.log(error);
          res.send(500, json.error('failed to create customer'));
        }
      } else {
        debug.log('new customer created');

        UserService.create({
          email: customer.name + '-agent@theeye.io',
          customers: [ customer.name ],
          credential: 'agent',
          enabled: true
        }, function(error, user) {
          if(error) {
            debug.error('creating user agent for customer');
            debug.error(error);

            customer.remove(function(e){
              if(e) return debug.error(e);
              debug.log('customer %s removed', customer.name);
            });

            if(error.code == 11000) { //duplicated
              res.send(400, json.error('customer user agent already registered'));
            } else {
              debug.log(error);
              res.send(500, json.error('failed to create user agent'));
            }
          } else {
            debug.log('user agent created');

            return res.send(201, {
              customer: customer.publish(), 
              user: user.publish()
            });
          } 
        });
      }
    });
  },
  /**
   * @method PATCH 
   * @route /customer/:customer
   */
  update : function(req, res, next)
  {
    var customer = req.customer;
    if(!customer) return req.send(404, 'not found');

    var updates = {};
    if(req.params.description) updates.description = req.params.description;
    if(req.params.emails) updates.emails = req.params.emails;

    if( Object.keys( updates ).length === 0 ) {
      return res.send(400,'nothing to update');
    }

    CustomerService.update( customer, updates, function(error, data){
      return res.send(205, { 'customer' : data });
    });
  },
  /**
   *
   * mantein the same customer ,
   * but replace the customer properties values with the data provided.
   *
   * @author Facundo
   * @method PUT
   * @route /customer/:customer
   */
  replace : function(req, res, next) {
    var customer = req.customer;
    if(!customer) return req.send(404, 'not found');

    var description = req.params.description || '';
    var emails = req.params.emails || [];

    var updates = {
      'description': description,
      'emails': emails
    };

    CustomerService.update( customer, updates, function(error, data){
      return res.send(205, { 'customer' : data });
    });
  },
  /**
   *
   *
   */
  remove : function (req, res, next) {
    var customer = req.customer;
    if(!customer) return req.send(404);

    CustomerService.remove(customer, function(error){
      if(!error) {
        /** disable customer hosts **/
        HostService.disableHostsByCustomer(customer);
        /** disable customer resources **/
        ResourceService.disableResourcesByCustomer(customer);
      
        return res.send(204);
      }
      else return res.send(500);
    });
  }
};
