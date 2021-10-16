const crud = require('./crud')
const graph = require('./graph')
const job = require('./job')
const acl = require('./acl')
const triggers = require('./triggers')
const integrations = require('./integrations')
const scheduler = require('./scheduler')
const recipe = require('./recipe')

module.exports = (server) => {
  job(server)
  recipe(server)
  acl(server)
  crud(server)
  graph(server)
  triggers(server)
  integrations(server)
  scheduler(server)
}
