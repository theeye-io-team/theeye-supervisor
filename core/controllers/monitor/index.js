const crud = require('./crud')
const nested = require('./nested')

module.exports = (server) => {
  crud(server)
  nested(server)
}
