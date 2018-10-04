const crud = require('./crud')
const scheduler = require('./scheduler')
const recipe = require('./recipe')

module.exports = (server, passport) => {
  crud(server, passport)
  scheduler(server, passport)
  recipe(server, passport)
}
