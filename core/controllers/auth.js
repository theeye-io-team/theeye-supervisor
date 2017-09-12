'use strict';

var Token = require('../lib/auth/token');
var passport = require('passport');
var router = require('../router');
var logger = require('../lib/logger')('controller:customer');
var json = require('../lib/jsonresponse');
var User = require("../entity/user").Entity;
var Customer = require("../entity/customer").Entity;

var CustomerService = require('../service/customer');
var UserService = require('../service/user');
var async = require('async');

module.exports = function (server) {
  /**
   * use basic authentication to obtain a new token
   */
  server.post('/token', [
    passport.authenticate('basic',{session:false})
  ], function (req,res,next) {
    var user = req.user;

    Token.create(
      user.client_id,
      user.client_secret,
      function (error,data) {
        if (error) {
          return res.send(400,'Error');
        } else {
          user.update({
            token: data.token,
            timestamp: data.timestamp
          }, function (error) {
            if (error) {
              throw new Error('user token update fails');
            } else {
              return res.send(200, data.token);
            }
          });
        }
      }
    );
    next();
  });
  server.post('/register',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('root'),
  ], controller.register);
};

var controller = {
  register: function(req, res, next) {
    if(!req.body.username) return res.send(400, 'name is required');
    if(!req.body.email) return res.send(400, 'email is required');
    if(!req.body.customername) return res.send(400, 'customername is required');

    var newCustomer = {
      name: req.body.customername,
      emails: [req.body.email]
    };

    var agentUser, ownerUser = null;
    Customer.findOne({ 'name': req.body.customername }, function(error, existentCustomer) {
      if (error)
        return responseError(error, res)
      if (existentCustomer)
        return responseError({statusCode: 400, message: 'Organization name already in use.'}, res)
      User.findOne({ 'username': req.body.username }, function(error, existentUser) {
        if (error)
          return responseError(error, res)
        if (existentUser)
          return responseError({statusCode: 400, message: 'Username already in use.'}, res)

        CustomerService.create(newCustomer, function(err,customer) {
          if(err) {
            logger.log(err);
            err.statusCode || (err.statusCode = 500)
            return responseError(err, res)
          } else {
            logger.log('new customer created');
            async.parallel([
              function(callback) {
                UserService.create({
                  email: customer.name + '-agent@theeye.io',
                  customers: [ customer.name ],
                  credential: 'agent',
                  enabled: true,
                  username: customer.name + '-agent@theeye.io'
                }, function(error, user) {
                  if(error) {
                    callback(error, null);
                    return;
                  } else {
                    agentUser = user;
                    logger.log('user agent created');
                    customer.agent = agentUser;

                    customer.save(function(error) {
                      if(error){
                        callback(error, null);
                        return;
                      }
                      logger.log('Customer agent updated.');
                      callback(null, agentUser);
                      return;
                    });
                  }
                });
              },
              function(callback) {
                UserService.create({
                  email: req.body.email,
                  customers: [ customer.name ],
                  credential: 'owner',
                  enabled: true,
                  username: req.body.username
                }, function(error, user) {
                  if(error) {
                    callback(error, null);
                    return;
                  }
                  ownerUser = user;
                  logger.log('Owner user created.');
                  callback(null, ownerUser);
                  return;
                });
              }
            ], function(err, results) {
              if (err) {
                if (customer) {
                  customer.remove(function(e){
                    if(e) return logger.error(e);
                    logger.log('customer %s removed', customer.name);
                  });
                }
                if (agentUser) {
                  agentUser.remove(function(e){
                    if(e) return logger.error(e);
                    logger.log('customer %s removed', agentUser.username);
                  });
                }
                if (ownerUser) {
                  ownerUser.remove(function(e){
                    if(e) return logger.error(e);
                    logger.log('customer %s removed', ownerUser.username);
                  });
                }

                err.statusCode || (err.statusCode = 500)
                return responseError(err, res)

              } else {
                return res.send(201, ownerUser);
              }
            });
          }
        });
      });
    });
  }
};

const responseError = (e,res) => {
  //logger.error('%o',e)
  const errorRes = {
    error: e.message,
    info: []
  }
  if (e.info) {
    errorRes.info.push( e.info.toString() )
  }
  res.send( e.statusCode || 500, errorRes )
}
