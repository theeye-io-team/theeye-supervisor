const GatewayUser = require('./user')
const GatewayMember = require('./member')

class Gateway {

  constructor () {
    this.user = new GatewayUser()
    this.member = new GatewayMember()
  }

}

module.exports = Gateway
