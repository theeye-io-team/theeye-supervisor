// DEPRECATED
// DEPRECATED
// DEPRECATED
// DEPRECATED
// DEPRECATED
// DEPRECATED
//
console.log('CUSTOMERS CONTROLLER DEPRECATED')

const crud = require('./crud')
const tokens = require('./tokens')

module.exports = (server) => {
  crud(server)
  tokens(server)
}
