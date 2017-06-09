const mongodb = require('../core/lib/mongodb');
const mongoose = require('mongoose');
const App = {}

mongodb.connect(function(){

  App.Event = require('./entity/event')
  App.File = require('./entity/file')
  App.Host = require('./entity/host').Entity
  App.HostGroup = require('./entity/host/group').Entity
  App.HostStats = require('./entity/host/stats').Entity
  App.Job = require('./entity/job')
  App.Monitor = require('./entity/monitor').Entity
  App.MonitorTemplate = require('./entity/monitor/template').Entity
  App.Resource = require('./entity/resource').Entity
  App.ResourceTemplate = require('./entity/resource/template').Entity
  App.Task = require('./entity/task').Entity
  App.ScraperTask = require('./entity/task/scraper').Entity
  App.TaskTemplate = require('./entity/task/template').Entity
  App.AgentUpdateJob = require('./entity/job/agent-update').Entity
  App.Webhook = require('./entity/webhook').Entity
  App.Customer = require('./entity/customer').Entity
  App.Tag = require('./entity/tag').Entity
  App.User = require('./entity/user').Entity

  console.log('entities loaded')

})

module.exports = App
