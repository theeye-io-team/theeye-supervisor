const ngrok = require('./ngrok')

module.exports = (server, passport) => {
  ngrok(server,passport)
}
