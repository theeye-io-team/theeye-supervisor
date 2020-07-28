const Job = require('../entity/job')
const Monitor = require('../entity/monitor')
const Customer = require('../entity/customer')
const Host = require('../entity/host').Host

module.exports = {
  Models: {
    Monitor,
    Customer,
    Host,
    Job
  }
}
