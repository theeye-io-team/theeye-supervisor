'use strict';

var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var User = require('../../entity/user').Entity;
var debug = require('../logger')(':auth');
var moment = require('moment');

module.exports = {
  initialize (options) {
    options||(options={});

    passport.use(new BasicStrategy(function(client_id, client_secret, done){
      debug.log('new connection [basic]');

      User.findOne({
        client_id: client_id,
        client_secret: client_secret
      }, function(error, user) {
        if (error) return done(error); 
        if (!user) {
          debug.error('invalid request, client %s', client_id);
          return done(null, false); 
        } else {
          debug.log('client "%s" connected [basic]', user.client_id);
          return done(null, user);
        }
      });
    }));

    passport.use(new BearerStrategy(function(token, done){
      var timestamp = moment().format('YYYY-MM-DD HH:00:00');
      debug.log('new connection [bearer]');

      User.findOne({
        token: token, 
        //timestamp: timestamp 
      }, function (error, user) {
        if (error) {
          debug.error('error fetching user by token');
          debug.error(error);
          return done(error);
        } else if (!user) {
          debug.error('invalid or outdated token %s', token);
          return done(null, false); 
        } else {
          debug.log('client "%s" connected [bearer]', user.client_id );
          return done(null, user);
        }
      })
    }));

    return passport;
  }
}
