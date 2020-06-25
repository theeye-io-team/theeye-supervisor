const BaseSchema = require('./schema')
//const logger = require('../../lib/logger')('entity:job:agent-update')
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')

const AgentUpdateJobSchema = new BaseSchema({
  name: {
    type: String,
    default: JobConstants.AGENT_UPDATE
  },
  lifecycle: {
    type: String,
    default: LifecycleConstants.READY
  },
  notify: {
    type: Boolean,
    default: false
  }
})

module.exports = AgentUpdateJobSchema
