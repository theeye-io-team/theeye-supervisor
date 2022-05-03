const crud = require('./crud')
const scheduler = require('./scheduler')
const serialize = require('./serialize')
const integrations = require('./integrations')
const job = require('./job')
const acl = require('./acl')

module.exports = (server) => {
  crud(server)
  scheduler(server)
  serialize(server)
  integrations(server)
  job(server)
  acl(server)
}
