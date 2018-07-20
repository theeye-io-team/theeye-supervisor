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
            timestamp: data.timestamp,
            last_update: new Date()
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
  })

  server.post('/register',[
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('root'),
  ], controller.register)
}

const rollback = (customer,agent,owner) => {
  if (customer) {
    customer.remove(function(e){
      if (e) return logger.error(e)
      logger.log('customer %s removed', customer.name)
    })
  }

  if (agent) {
    agent.remove(function(e){
      if (e) return logger.error(e)
      logger.log('customer %s removed', agent.username)
    })
  }

  if (owner) {
    owner.remove(function(e){
      if (e) return logger.error(e)
      logger.log('customer %s removed', owner.username)
    })
  }
}

const createCustomer = (input,done) => {
  const name = input.name
  CustomerService.create({ name: name }, (err,customer) => {
    if (err) {
      logger.log(err)
      err.statusCode || (err.statusCode = 500)
      return responseError(err, res)
    }

    logger.log('customer created')
    async.mapValues({
      agent: {
        email: name + '-agent@theeye.io',
        username: name + '-agent',
        customers: [ name ],
        credential: 'agent',
        enabled: true,
      },
      owner: {
        email: input.owner_email,
        username: input.owner_username,
        customers: [ name ],
        credential: 'owner',
        enabled: true
      }
    }, (data, name, next) => {
      UserService.create(data, next)
    }, (err, users) => {
      if (err) {
        rollback(customer,users.agent,users.owner)
        return done(err)
      }

      customer.agent = users.agent
      customer.owner = users.owner
      customer.owner_id = users.owner._id
      customer.save(err => { if (err) logger.error(err) })
      done(null,customer)
    })
  })
}

const responseError = (e,res) => {
  //logger.error('%o',e)
  const errorRes = {
    error: e.message,
    info: [],
    errorCode: e.errorCode || undefined
  }
  if (e.info) {
    errorRes.info.push( e.info.toString() )
  }
  res.send( e.statusCode || 500, errorRes )
}

const controller = {
  register (req, res, next) {
    if (!req.body.username) return res.send(400, 'name is required')
    if (!req.body.email) return res.send(400, 'email is required')
    if (!req.body.customername) return res.send(400, 'customername is required')

    Customer.findOne({
      name: req.body.customername
    }, (error, customer) => {
      if (error) return responseError(error, res)
      if (customer) {
        return responseError({
          statusCode: 400,
          message: 'Organization name already in use.',
          errorCode: 'organizationInUse'
        }, res)
      }

      User.findOne({
        username: req.body.username
      }, (error, user) => {
        if (error) return responseError(error, res)
        if (user) {
          return responseError({
            statusCode: 400,
            message: 'Username already in use.',
            errorCode: 'usernameInUse'
          }, res)
        }

        createCustomer({
          name: req.body.customername,
          owner_username: req.body.username,
          owner_email: req.body.email
        }, (err, customer) => {
          if (err) {
            err.statusCode || (err.statusCode = 500)
            return responseError(err, res)
          }
          return res.send(201, customer.owner)
        })
      })
    })
  }
}
