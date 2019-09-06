
const Job = require('../../entity/job').AgentUpdate
const Host = require('../../entity/host').Host
const logger = require('../../lib/logger')('commander:agents-update')
const moment = require('moment')

/**
 *
 * update all agents settings at once
 *
 * create the agent update job for each active host
 *
 */
const agentsUpdate = (server) => {
  server.put('/agents', (req, res, next) => {
    let today = moment().utc().startOf('day').toISOString()
    Host.find({
      enabled: { $ne: false },
      last_update: { $gt: today }
    }, (err, hosts) => {
      res.send(204)
      hosts.forEach(host => {
        Job.create({ host_id: host._id.toString() }, (err, job) => {
          logger.log(`job created ${job._id}`)
        })
      })
    })
  })

  server.get('/agents', (req, res, next) => {
    Job.find({ _type: 'AgentUpdateJob' }, (err, jobs) => {
      res.send(200, jobs)
    })
  })
}

module.exports = agentsUpdate
