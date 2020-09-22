const Customer = require('../entity/customer')
const File = require('../entity/file')
const Host = require('../entity/host')
const Job = require('../entity/job')
const Monitor = require('../entity/monitor')
const Task = require('../entity/task')
const Workflow = require('../entity/workflow')

module.exports = {
  Models: {
    Customer,
    File,
    Host,
    Job,
    Monitor,
    Task,
    Workflow
  }
}
