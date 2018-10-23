'use strict';

const crud = require('./crud')
const tokens = require('./tokens')

module.exports = (server, passport) => {
  crud(server, passport)
  tokens(server, passport)
}
