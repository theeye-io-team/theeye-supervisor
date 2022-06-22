const crud = require('./crud')
const gateway = require('./gateway')
const scheduler = require('./scheduler')
const serialize = require('./serialize')
const integrations = require('./integrations')
const job = require('./job')
const acl = require('./acl')

module.exports = (server) => {
  crud(server)
  gateway(server)
  scheduler(server)
  serialize(server)
  integrations(server)
  job(server)
  acl(server)
}
