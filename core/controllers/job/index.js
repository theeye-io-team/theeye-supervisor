const crud = require('./crud')
const lifecycle = require('./lifecycle')

module.exports = (server) => {
  crud(server)
  lifecycle(server)
}
