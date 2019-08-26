const crud = require('./crud')
const graph = require('./graph')
const job = require('./job')
const triggers = require('./triggers')
const integrations = require('./integrations')

module.exports = (server, passport) => {
  crud(server, passport)
  job(server, passport)
  graph(server, passport)
  triggers(server, passport)
  integrations(server, passport)
}
