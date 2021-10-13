const crud = require('./crud')
const create = require('./create')
const acl = require('./acl')
const lifecycle = require('./lifecycle')
const queue = require('./queue')

module.exports = (server) => {
  create(server)
  queue(server)
  crud(server)
  acl(server)
  lifecycle(server)
}
