const crud = require('./crud')
const counter = require('./counter')

module.exports = (server) => {
  crud(server)
  counter(server)
}
