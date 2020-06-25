const crud = require('./crud')
const graph = require('./graph')
const job = require('./job')
const triggers = require('./triggers')
const integrations = require('./integrations')

module.exports = (server) => {
  job(server)
  crud(server)
  graph(server)
  triggers(server)
  integrations(server)
}
