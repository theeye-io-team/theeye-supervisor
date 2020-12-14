const Customer = require('../entity/customer')
const File = require('../entity/file')
const Host = require('../entity/host')
const Indicator = require('../entity/indicator')
const Job = require('../entity/job')
const Monitor = require('../entity/monitor')
const Resource = require('../entity/resource')
const Tag = require('../entity/tag')
const Task = require('../entity/task')
const Webhook = require('../entity/webhook')
const Workflow = require('../entity/workflow')
const Event = require('../entity/event')

module.exports = {
  Models: {
    Customer,
    Event,
    File,
    Host,
    Indicator,
    Job,
    Monitor,
    Resource,
    Tag,
    Task,
    Webhook,
    Workflow
  }
}
