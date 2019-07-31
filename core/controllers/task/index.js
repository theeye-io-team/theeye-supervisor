const crud = require('./crud')
const scheduler = require('./scheduler')
const recipe = require('./recipe')
const integrations = require('./integrations')

module.exports = (server, passport) => {
  crud(server, passport)
  scheduler(server, passport)
  recipe(server, passport)
  integrations(server, passport)
}
