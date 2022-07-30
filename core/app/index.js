const MongoDB = require('../lib/mongodb')
const logger = require('../lib/logger')('app')
//const User = require('../entity/user').Entity
const App = {}
const AWS = require('aws-sdk')
const { v5: uuidv5 } = require('uuid')
const StateHandler = require('./state')

module.exports = App

App.boot = async (config) => {

  App.namespace = uuidv5(config.system.secret, config.system.secret_uuid)

  App.config = config
  App.db = await MongoDB.connect(config.mongo)

  const Models = require('./models')
  const Events = require('../service/events')

  Object.assign(App, Models)

  const start = async () => {
    configureAws(config.integrations.aws)

    App.state = StateHandler(App)
    App.user = getApplicationUser()
    StartServices()

    Api()
    Commander()
    Monitoring()

    logger.log('App is ready')
  }

  const StartServices = async () => {
    logger.log('initializing scheduler')
    App.scheduler = require('../service/scheduler')
    await App.scheduler.initialize(config.scheduler)
    App.eventDispatcher = Events.createDispatcher() 
    App.jobDispatcher = require('../service/job')
    App.resource = require('../service/resource')
    App.task = require('../service/task')
    App.file = require('../service/file')
    App.host = require('../service/host')
    App.logger = require('../service/logger')
    App.hostTemplate = require('../service/host/group')
    App.notifications = require('../service/notification')
    App.resourceMonitor = require('../service/resource/monitor')

    const Gateway = require('../service/gateway')
    App.gateway = new Gateway()
  }

  const Api = require('./api')
  //const Api = require('./api-sentry')
  const Commander = require('./commander')
  const Monitoring = require('./monitoring')

  const configureAws = (aws) => {
    if (aws.enabled === true) { // then configure AWS SDK
      logger.log('configuring aws integration')
      AWS.config.update( aws.config )
    }
  }

  const getApplicationUser = () => {
    return {}
  }

  start()
}
