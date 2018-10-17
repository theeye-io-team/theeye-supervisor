"use strict"

const config = require('config')
const logger = require('../lib/logger')('app')
const User = require('../entity/user').Entity

const App = {
  initialize (done) {
    getApplicationUser((error,user) => {
      if (error) {
        logger.error('cannot initialize application user')
        throw error
      }

      App.user = user
      logger.log('apps is ready')
      done()
    })
  },
  startApi: require('./api'),
  startCommander: require('./commander')
}

const getApplicationUser = (next) => {
  User.findOne(config.system.user, (err, user) => {
    if (err) return next(err)
    if (!user) {
      // system user not found. create one
      let user = new User(config.system.user)
      user.save( err => {
        if (err) return next(err)
        next(null, user)
      })
    } else {
      next(null, user)
    }
  })
}

module.exports = App
