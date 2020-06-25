const ngrok = require('./ngrok')

module.exports = (server) => {
  ngrok(server)
}
