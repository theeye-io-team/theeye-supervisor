'use strict';

var Token = require('../lib/auth/token');
var passport = require('passport');

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
              res.send(200, data.token);
            }
          });
        }
      }
    );
    next();
  });
}
