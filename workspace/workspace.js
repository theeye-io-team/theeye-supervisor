
const Core = __dirname + '/../core'

const config = require('config')
const App = require(Core + '/app')
const logger = require(Core + '/lib/logger')('workspace')

const createApp = async () => {

  logger.log('NODE_ENV is %s', process.env.NODE_ENV)

  logger.log('booting app')
  await App.boot(config)

  return App
}

module.exports = createApp
