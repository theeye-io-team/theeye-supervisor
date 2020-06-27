const passport = require('passport')
const BearerStrategy = require('passport-http-bearer').Strategy
const BasicStrategy = require('passport-http').BasicStrategy
const jwt = require('jsonwebtoken')

//var User = require('../../entity/user').Entity;
//var moment = require('moment');
const logger = require('../logger')(':auth')
const http = require('http')
const https = require('https')
const config = require('config').authentication

const request = config.protocol === 'https' ? https.request : http.request

const requestOptions = {
  host: config.api.host,
  port: config.api.port
}

module.exports = {
  initialize () {
    const basicStrategy = new BasicStrategy(async (client_id, client_secret, done) => {
      logger.log('new connection [basic]')
      try {
        let response = await createSession(client_id, client_secret)
        if (response.statusCode === 200) {
          let json = JSON.parse(response.rawBody)
          return done(null, json.access_token)
        } else {
          logger.error(client_id, client_secret)
          logger.error(response.rawBody)
          let err = new Error(`authentication failed`)
          err.name = 'authentication failed'
          err.body = response.rawBody
          err.statusCode = response.statusCode || 500
          throw err
        }
      } catch (err) {
        logger.error(err)
        if (!err.statusCode) {
          err.statusCode = 500
        }
        return done(err)
      }
    })

    const bearerStrategy = new BearerStrategy((token, done) => {
      logger.log('new connection [bearer]')
      /**
       * verify incomming json web token validity
       */
      //let decoded = jwt.verify(token, config.secret, {}, (err, decoded) => {
      //  if (err) {
      //    logger.error(err)
      //    err.status = 401
      //    return done(err)
      //  } else {
          //sessionVerify(token).then(profile => {})
          fetchProfile(token)
            .then(response => {
              if (response.statusCode === 200) {
                let profile = JSON.parse(response.rawBody)
                return done(null, profile)
              } else {
                logger.error(response.rawBody, response.statusCode)
                let err = new Error(`authentication failed`)
                err.name = 'authentication failed'
                err.body = response.rawBody
                err.statusCode = response.statusCode || 500
                throw err
              }
            })
            .catch(err => {
              done(err)
            })
      //  }
      //})
    })

    passport.use(basicStrategy)
    passport.use(bearerStrategy)

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
          req.user = profile
          req.params.customer = profile.current_customer.name
          //req.customer = profile.current_customer
          next()
        }
      }, { session: false })(req, res, next)
    }

    return { bearerMiddleware }
  }
}

const fetchProfile = (token) => {
  return new Promise((resolve, reject) => {
    let reqOpts = Object.assign({
      path: `/api/session/profile?access_token=${token}`,
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

const createSession = (user, pass) => {
  return new Promise((resolve, reject) => {
    const creds = Buffer.from(`${user}:${pass}`).toString('base64')
    let reqOpts = Object.assign({
      path: `/api/auth/login`,
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

const sessionVerify = (token) => {
  return new Promise((resolve, reject) => {
    let reqOpts = Object.assign({
      path: `/api/session/verify?access_token=${token}`,
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
        try {
          resolve(JSON.parse(str))
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', error => reject(error))
    //req.write(JSON.stringify(payload))
    req.end()
  })
}
