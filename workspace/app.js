'use strict'

const debug = require('debug')('eye:workspace')

const CorePath = '../core'
const EntitiesPath = CorePath + '/entity'

const mongodb = require(CorePath + '/lib/mongodb')
const mongoose = require('mongoose')

if (!process.env.NODE_ENV) {
  console.error('NODE_ENV not defined')
  return
}


module.exports = function (next) {

  next || (next = () => {})
  const App = { Models: {} }

  mongodb.connect(function(){

    App.Tag = require(EntitiesPath + '/tag').Entity
    App.User = require(EntitiesPath + '/user').Entity
    App.Customer = require(EntitiesPath + '/customer').Entity
    App.File = require(EntitiesPath + '/file')
    App.Host = require(EntitiesPath + '/host').Entity
    App.HostGroup = require(EntitiesPath + '/host/group').Entity
    App.HostStats = require(EntitiesPath + '/host/stats').Entity
    App.Resource = require(EntitiesPath + '/resource').Entity
    App.ResourceTemplate = require(EntitiesPath + '/resource/template').Entity
    App.Monitor = require(EntitiesPath + '/monitor').Entity
    App.MonitorTemplate = require(EntitiesPath + '/monitor/template').Entity
    App.Task = require(EntitiesPath + '/task').Entity
    App.ScraperTask = require(EntitiesPath + '/task/scraper').Entity
    App.TaskTemplate = require(EntitiesPath + '/task/template').Entity
    App.Webhook = require(EntitiesPath + '/webhook').Entity
    App.Event = require(EntitiesPath + '/event').Event
    App.TaskEvent = require(EntitiesPath + '/event').TaskEvent
    App.MonitorEvent = require(EntitiesPath + '/event').MonitorEvent
    App.WebhookEvent = require(EntitiesPath + '/event').WebhookEvent
    App.Models.Indicator = require(EntitiesPath + '/indicator')
    App.Models.Job = {
      Job: require(EntitiesPath + '/job').Job,
      AgentUpdate: require(EntitiesPath + '/job').AgentUpdate,
      Script: require(EntitiesPath + '/job').Script,
      Scraper: require(EntitiesPath + '/job').Scraper
    }

    debug('entities loaded')

    next(null,App)
  })

}
