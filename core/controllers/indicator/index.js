const crud = require('./crud')
const counter = require('./counter')

module.exports = (server, passport) => {
  crud(server, passport)
  counter(server, passport)
}
