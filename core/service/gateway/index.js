const GatewayUser = require('./user')
const GatewayMember = require('./member')
const GatewayAC = require('./accesscontrol')

class Gateway {

  constructor () {
    this.user = new GatewayUser()
    this.member = new GatewayMember()
    this.accesscontrol = new GatewayAC()
  }

}

module.exports = Gateway
