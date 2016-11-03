"use strict";

const crypto = require('crypto');
const config = require('config');

module.exports = function (options) {

  // a random secret word
  var max=9999999999,min=1111111111;
  var bytes = Math.floor(config.system.secret||Math.random() * (max - min) + min) ;
  var rand = Math.floor(Math.random() * (max - min) + min);

  return crypto
    .createHmac('sha256', String(bytes + rand))
    .update(new Date().toISOString())
    .digest('hex');

}
