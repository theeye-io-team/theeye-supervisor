const crud = require('./crud')
const create = require('./create')
const acl = require('./acl')
const lifecycle = require('./lifecycle')

module.exports = (server) => {
  create(server)
  crud(server)
  acl(server)
  lifecycle(server)
}
