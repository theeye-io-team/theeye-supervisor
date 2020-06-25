//const merge = require('lodash/merge')
//const assign = require('lodash/assign')
//const isURL = require('validator/lib/isURL')
//const logger = require('../../lib/logger')('controller:customer')
//const json = require('../../lib/jsonresponse')
//const router = require('../../router')
//const ResourceService = require('../../service/resource')
//const HostService = require('../../service/host')
//
//const CustomerModel = require('../../entity/customer').Entity
//const CustomerService = require('../../service/customer')
////const User = require('../../entity/user').Entity
////const UserService = require('../../service/user')
//
//const CustomerConstants = require('../../constants/customer')
//
//module.exports = (server) => {
//  var middlewares = [
//    server.auth.bearerMiddleware,
//    router.requireCredential('root'),
//    router.resolve.idToEntity({param:'customer',required:true}),
//    router.ensureCustomer,
//  ]
//
//  server.get('/customer/:customer', [
//    server.auth.bearerMiddleware,
//    router.resolve.idToEntity({ required: true, param: 'customer' }),
//    router.ensureCustomer
//  ], controller.get)
//
//  //
//  // users can fetch its own current customer information
//  //
//  server.get('/:customer/customer', [
//    server.auth.bearerMiddleware,
//    router.resolve.customerNameToEntity({ required: true }),
//    router.ensureCustomer
//  ], controller.get)
//
//  server.del('/customer/:customer', middlewares,controller.remove);
//  server.patch('/customer/:customer',middlewares,controller.patch);
//  server.patch('/customer/:customer/config',[
//    server.auth.bearerMiddleware,
//    router.requireCredential('admin'),
//    router.resolve.idToEntity({param:'customer',required:true}),
//    router.ensureCustomer,
//  ], controller.updateconfig)
//
//  server.get('/customer',[
//    server.auth.bearerMiddleware,
//    router.requireCredential('root'),
//  ], controller.fetch)
//
//  server.post('/customer',[
//    server.auth.bearerMiddleware,
//    router.requireCredential('root'),
//  ], controller.create)
//}
//
//var controller = {
//  /**
//   *
//   */
//  get (req, res, next) {
//    res.send(200, req.customer.publish())
//  },
//  /**
//   *
//   */
//  fetch (req, res, next) {
//    queryCustomers(req, (err, customers) => {
//      if (err) {
//        if (err.statusCode) {
//          return res.send(err.statusCode, err.message)
//        } else {
//          logger.error('error fetching customers. ' + err.message)
//          return res.send(500, json.error('failed to fetch customers'))
//        }
//      } else {
//        const published = []
//
//        for (var c=0; c<customers.length; c++) {
//          published.push( customers[c].publish() )
//        }
//
//        return res.send(200, customers.map(customer => customer.publish()) )
//      }
//    })
//  },
//  /**
//   *
//   */
//  create (req,res,next) {
//    const input = req.body
//
//    if (!input.name) {
//      return res.send(400, json.error('name is required'))
//    }
//
//    if (CustomerConstants.CUSTOMER_RESERVED_NAMES.indexOf(input.name) !== -1) {
//      return res.send(400, json.error('please, choose another name.'))
//    }
//
//    if (input.config) {
//      const elasticsearch = input.config.elasticsearch
//      if (elasticsearch && elasticsearch.enabled === true) {
//        if (!elasticsearch.url) {
//          return res.send(400, json.error('elasticsearch.url is required when elasticsearch.enabled'))
//        } else if (!isURL(elasticsearch.url)) {
//          return res.send(400, json.error('elasticsearch.url must be valid URL'))
//        }
//      }
//    }
//
//    CustomerService.create(input, function(error,customer) {
//      if (error) {
//        if (error.code == 11000) { //duplicated
//          res.send(400, json.error(input.name + ' customer already exists'))
//        } else {
//          logger.log(error)
//          res.send(500, json.error('failed to create customer'))
//        }
//      } else {
//        logger.log('new customer created')
//
//        UserService.create({
//          username: 'agent+' + customer.name + '@theeye.io',
//          email: 'agent+' + customer.name + '@theeye.io',
//          customers: [ customer.name ],
//          credential: 'agent',
//          enabled: true
//        }, function(error, user) {
//          if (error) {
//            logger.error('creating user agent for customer')
//            logger.error(error)
//
//            customer.remove(function(e){
//              if (e) return logger.error(e)
//              logger.log('customer %s removed', customer.name)
//            })
//
//            if (error.code == 11000) { //duplicated
//              res.send(400, json.error('customer user agent already registered'))
//            } else {
//              logger.log(error)
//              res.send(500, json.error('failed to create user agent'))
//            }
//          } else {
//            logger.log('user agent created')
//            customer.agent = user
//            return res.send(201, customer)
//          }
//        })
//      }
//    })
//  },
//  /**
//   * @method PATCH
//   *
//   * @route /customer/:customer
//   */
//  patch (req, res, next) {
//    const customer = req.customer
//    const updates = req.body
//
//    if (updates.config) {
//      const elasticsearch = updates.config.elasticsearch
//      if (elasticsearch && elasticsearch.enabled === true) {
//        if (!elasticsearch.url) {
//          return res.send(400, json.error('elasticsearch.url is required when elasticsearch.enabled'))
//        } else if (
//          ! isURL(elasticsearch.url,{
//            protocols: ['http','https'],
//            require_protocol: true
//          })
//        ) {
//          return res.send(400, json.error('elasticsearch.url must be a valid URL'))
//        }
//      }
//    }
//
//    customer.config = merge({}, customer.config, updates.config)
//
//    if (updates.description) {
//      customer.description = updates.description
//    }
//
//    if (updates.owner_id) {
//      User.findOne({ _id : updates.owner_id }, function (error, user) {
//        if(error)
//          res.send(500,error);
//        if(!user)
//          res.send(400,'Owner not found');
//        customer.owner_id = user._id;
//        customer.owner = user;
//      });
//    }
//
//    customer.save( (err,model) => {
//      if (err) {
//        res.send(500,err)
//      } else {
//        res.send(200, customer)
//      }
//      next()
//    })
//  },
//  /**
//   * @method PATCH
//   *
//   * @route /customer/:customer/config
//   */
//  updateconfig (req, res, next) {
//    const customer = req.customer
//    let config = req.body.config;
//
//    const integration = req.body.integration
//    if (!integration) {
//      return res.send(400, json.error('Missing config values.'))
//    }
//
//    // NOTE: gone to kibana case
//    // if (!config && (integration !== 'kibana')) {
//    //   return res.send(400, json.error('Missing config values.'))
//    // }
//
//    switch (integration) {
//      case 'elasticsearch':
//        if (config.enabled === true) {
//          if (
//            !isURL(config.url, {
//              protocols: ['http','https'],
//              require_protocol: true
//            })
//          ) {
//            return res.send(400, json.error('elasticsearch url must be a valid URL'));
//          }
//        }
//        break;
//      case 'kibana':
//        // error if empty config
//        if (!config) {
//          return res.send(400, json.error('Missing config values.'));
//        }
//
//        // convert old school kibana config
//        // NOTE: MUTATES `config`
//        if (typeof (config) === 'string') {
//          config = {
//            url: config,
//            enabled: true
//          };
//        }
//
//        if (config.enabled === true) {
//          if (
//            !isURL(config.url, {
//              protocols: ['http','https'],
//              require_protocol: true
//            })
//          ) {
//            return res.send(400, json.error('kibana url must be a valid URL'));
//          }
//        }
//
//        break;
//      case 'ngrok':
//        break;
//      default:
//        break;
//    }
//
//    var newConfig = {};
//    newConfig[integration] = config;
//    customer.config = assign({}, customer.config, newConfig);
//
//    customer.save( (err,model) => {
//      if (err) {
//        res.send(500,err);
//      } else {
//        res.send(200, customer.config);
//      }
//      next();
//    });
//  },
//  /**
//   *
//   *
//   */
//  remove (req, res, next) {
//    var customer = req.customer;
//
//    CustomerService.remove(customer, err => {
//      if (err) {
//        logger.error(err);
//        return res.send(500,err);
//      }
//
//      /** disable customer hosts **/
//      HostService.disableHostsByCustomer(customer);
//      /** disable customer resources **/
//      ResourceService.disableResourcesByCustomer(customer);
//
//      logger.data('customer removed %j',customer);
//
//      res.json(200, customer);
//      next();
//    });
//  }
//}
//
//const queryCustomers = (req, next) => {
//  let query = {}
//
//  if (req.query) {
//    if (req.query.name) {
//      if (typeof req.query.name === 'string') {
//        query.name = req.query.name
//      } else {
//        let error = new Error('Invalid request.')
//        error.statusCode = 400
//        return next(error)
//      }
//    }
//  }
//
//  CustomerModel.find(query, (err, customers) => {
//    if (err) {
//      return next(err)
//    } else {
//      return next(null, customers)
//    }
//  })
//}
