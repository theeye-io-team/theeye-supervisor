const crud = require('./crud')
const nested = require('./nested')
const runner = require('./runner')

module.exports = (server) => {
  runner(server)
  crud(server)
  nested(server)
}
