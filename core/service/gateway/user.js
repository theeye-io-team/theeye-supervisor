const got = require('got')
const qs = require('qs')
const config = require('config')
const isEmail = require('validator/lib/isEmail')

const jwt = require('jsonwebtoken')

class GatewayUser {
  /**
   * @param {Array<String>} values can be email or username
   * @param {Object} context information about inprogress request
   */
  async fetch (values, context) {
    let url = config.gateway.user.url
    url += '?' + qs.stringify({
      where: { users: values },
      gateway_token: createGatewayToken(context)
    })

    const res = await got(url, {
      retry: { limit: 0 },
      headers: { 'content-type': 'application/json' },
      responseType: 'json'
    })

    const users = res.body
    return users
  }
}

const createGatewayToken = (context) => {                                             
  return jwt.sign(                                                                             
    { context },                                                                                   
    config.gateway.secret, // our Private Key                                                  
    {                                                                                          
      expiresIn: 60 // seconds                                                                 
    }                                                                                          
  )                                                                                            
}                                                                                              

module.exports = GatewayUser
