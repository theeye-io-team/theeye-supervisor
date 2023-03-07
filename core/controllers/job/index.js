const crud = require('./crud')
const create = require('./create')
const acl = require('./acl')
const result = require('./result')
const lifecycle = require('./lifecycle')

module.exports = (server) => {
  create(server)
  crud(server)
  acl(server)
  lifecycle(server)
  result(server)
}
