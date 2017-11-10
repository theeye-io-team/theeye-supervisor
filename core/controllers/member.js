'use strict';

var isEmail = require('validator/lib/isEmail')
var logger = require('../lib/logger')('controller:member');
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
  server.patch('/:customer/member/:user/credential',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.idToEntity({param:'user'}),
    router.filter.spawn({param:'customers', filter:'toArray'}),
    router.filter.spawn({param:'customers', filter:'uniq'}),
  ], controller.updateCrendential);

  server.del('/:customer/member/:user',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.idToEntity({ param:'user' }),
  ], controller.removeFromCustomer);
};


var controller = {
  updateCrendential (req, res, next) {
    var user = req.user;
    if (!user) return res.send(404, json.error('User not found'));

    var params = req.params;

    if (!params.credential) {
      return res.send(400, json.error('Missing credential.'));
    }

    UserService.update(user._id, {credential: params.credential}, function(error, user){
      if (error) {
        if (error.statusCode) {
          return res.send(error.statusCode, error.message);
        } else {
          logger.error(error);
          return res.send(500,'internal error');
        }
      } else {
        user.publish({
          include_customers : true
        }, function(error, data){
          if(error)
            return res.send(500,'internal error');
          res.send(200, data);
        });
      }
    });
  },
  removeFromCustomer (req, res, next) {
    var user = req.user;
    if (!user) return res.send(404, json.error('User not found'));

    var customerToRemove = req.params.customer;
    if (!customerToRemove) return res.send(404, json.error('Customer not found'));

    var customers = user.customers.map(customer => {
      return customer.name
    }).filter(customer => {
      return customer !== customerToRemove
    })

    UserService.update(user._id, {customers: customers}, function(error, user){
      if (error) {
        if (error.statusCode) {
          return res.send(error.statusCode, error.message);
        } else {
          logger.error(error);
          return res.send(500,'internal error');
        }
      } else {
        user.publish({
          include_customers : true
        }, function(error, data){
          res.send(200, data);
        });
      }
    });
  }
};
