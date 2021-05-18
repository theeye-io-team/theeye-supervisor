const crud = require('./crud')
const scheduler = require('./scheduler')
const recipe = require('./recipe')
const integrations = require('./integrations')
const job = require('./job')
const acl = require('./acl')

module.exports = (server) => {
  crud(server)
  scheduler(server)
  recipe(server)
  integrations(server)
  job(server)
  acl(server)
}
