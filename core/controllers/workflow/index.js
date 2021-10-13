const crud = require('./crud')
const crudv2 = require('./crudv2')
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
  crudv2(server)
  graph(server)
  triggers(server)
  integrations(server)
  scheduler(server)
}
