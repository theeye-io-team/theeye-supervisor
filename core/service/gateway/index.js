const GatewayUser = require('./user')

class Gateway {

  constructor () {
    this.user = new GatewayUser()
  }

}

module.exports = Gateway
