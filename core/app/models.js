const Job = require('../entity/job')
const Task = require('../entity/task')
const Monitor = require('../entity/monitor')
const Customer = require('../entity/customer')
const Host = require('../entity/host').Host

module.exports = {
  Models: {
    Monitor,
    Customer,
    Host,
    Job,
    Task
  }
}
