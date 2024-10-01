const passport = require('passport')
const BearerStrategy = require('passport-http-bearer').Strategy
const BasicStrategy = require('passport-http').BasicStrategy

const logger = require('../logger')(':auth')
const http = require('http')
const https = require('https')
const config = require('config').authentication

module.exports = {
  initialize () {
    const request = config.protocol === 'https' ? https.request : http.request

    const requestOptions = {
      host: config.api.host,
      port: config.api.port
    }

    const basicStrategyMiddleware = new BasicStrategy(async (client_id, client_secret, done) => {
      logger.log('new connection [basic]')
      try {
        let response = await createGatewaySession(client_id, client_secret)
        if (response.statusCode === 200) {
          let json = JSON.parse(response.rawBody)
          return done(null, json.access_token)
        } else {
          let err = new Error(`Gateway Authentication Failed`)
          err.creds = `${client_id}:${client_secret}`
          err.body = response.rawBody
          err.statusCode = response.statusCode || 500
          throw err
        }
      } catch (err) {
        logger.error('%j', err)
        if (!err.statusCode) { err.statusCode = 500 }
        return done(err)
      }
    })

    const bearerStrategyMiddleware = new BearerStrategy(async (token, done) => {
      try {
        //
        // WARNING!! Integration Tokens cannot be verified using JWT.verify
        //
        // 2023/09/06. Most of the Integration tokens were created with invalid expiration and issue date.
        // Tokens can be verified against the information stored in the sessions db by the Gateway API but cannot be verifies using JWT methods.
        //
        logger.log('new connection [bearer]')
        // @TODO use cache
        const response = await fetchGatewayProfile(token)
        if (response.statusCode === 200) {
          const profile = JSON.parse(response.rawBody)
          profile.token = token
          return done(null, profile)
        } else {
          logger.error(response.rawBody, response.statusCode)
          let err = new Error(`authentication failed`)
          err.name = 'authentication failed'
          err.body = response.rawBody
          err.statusCode = response.statusCode || 500
          throw err
        }
      } catch (err) {
        done(err)
      }
    })

    passport.use(basicStrategyMiddleware)
    passport.use(bearerStrategyMiddleware)

    const bearerMiddleware = (req, res, next) => {
      passport.authenticate('bearer', (err, profile) => {
        if (err) {
          if (err.status >= 400) {
            return res.send(401, 'Unauthorized')
          }
          next(err)
        } else if (!profile) {
          res.send(401, 'Unauthorized')
          //next(null, false)
        } else {
          const { principal, organization, member } = profile
          req.user = principal 
          req.user.credential = member.credential // re-map
          // get customer for the session
          req.session = {
            token: profile.token, 
            customer: organization,
            customer_name: organization.name,
            member,
            credential: member.credential
          }
          next()
        }
      }, { session: false })(req, res, next)
    }

    const fetchGatewayProfile = (token) => {
      const qs = [
        `access_token=${token}`,
        'scopes[]=principal',
        'scopes[]=organization',
        'scopes[]=member'
      ].join('&')

      return new Promise((resolve, reject) => {
        let reqOpts = Object.assign({
          //path: `${config.api.path.profile}?access_token=${token}`,
          path: `${config.api.path.profile}?${qs}`,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }, requestOptions)

        const req = request(reqOpts, res => {
          let str = ''
          res.on('data', d => { if (d) { str += d } })
          res.on('end', () =>  {
            res.rawBody = str
            resolve(res)
          })
        })
        req.on('error', error => reject(error))
        //req.write(JSON.stringify(payload))
        req.end()
      })
    }

    const createGatewaySession = (user, pass) => {
      return new Promise((resolve, reject) => {
        const creds = Buffer.from(`${user}:${pass}`).toString('base64')
        let reqOpts = Object.assign({
          path: config.api.path.login,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Basic ${creds}`
          }
        }, requestOptions)

        const req = request(reqOpts, function (res) {
          let str = ''
          res.on('data', d => { if (d) { str += d } })
          res.on('end', function () {
            res.rawBody = str
            resolve(res)
          })
        })
        req.on('error', error => reject(error))
        req.end()
      })
    }

    return { bearerMiddleware }
  }
}
