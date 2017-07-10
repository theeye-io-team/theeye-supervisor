'use strict'

const debug = require('debug')('eye:workspace')
const mongodb = require('../core/lib/mongodb')
const mongoose = require('mongoose')

if (!process.env.NODE_ENV) {
  console.error('NODE_ENV not defined')
  return
}

module.exports = function (next) {

  next || (next = () => {})
  const App = {}

  mongodb.connect(function(){

    App.Tag = require('./entity/tag').Entity
    App.User = require('./entity/user').Entity
    App.Customer = require('./entity/customer').Entity
    App.File = require('./entity/file')
    App.Host = require('./entity/host').Entity
    App.HostGroup = require('./entity/host/group').Entity
    App.HostStats = require('./entity/host/stats').Entity
    App.Resource = require('./entity/resource').Entity
    App.ResourceTemplate = require('./entity/resource/template').Entity
    App.Monitor = require('./entity/monitor').Entity
    App.MonitorTemplate = require('./entity/monitor/template').Entity
    App.Task = require('./entity/task').Entity
    App.ScraperTask = require('./entity/task/scraper').Entity
    App.TaskTemplate = require('./entity/task/template').Entity
    App.Webhook = require('./entity/webhook').Entity
    // job entities
    App.Job = require('./entity/job').Job
    App.AgentUpdateJob = require('./entity/job').AgentUpdate
    App.ScriptJob = require('./entity/job').Script
    App.ScraperJob = require('./entity/job').Scraper
    // event entities. requires webhook, task & monitor
    App.Event = require('./entity/event').Event
    App.TaskEvent = require('./entity/event').TaskEvent
    App.MonitorEvent = require('./entity/event').MonitorEvent
    App.WebhookEvent = require('./entity/event').WebhookEvent

    debug('entities loaded')

    next(null,App)
  })

}
