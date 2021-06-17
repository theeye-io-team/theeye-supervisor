const crud = require('./crud')
const acl = require('./acl')
const lifecycle = require('./lifecycle')

module.exports = (server) => {
  crud(server)
  acl(server)
  lifecycle(server)
}
