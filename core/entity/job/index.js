'use strict'

const middleware = require('./middleware')
const mongodb = require('../../lib/mongodb').db
const IntegrationConstants = require('../../constants/integrations')

const BaseSchema = require('./schema')
const AgentUpdateJobSchema = require('./agent-update')
const ScriptJobSchema = require('./script')

const JobSchema = new BaseSchema({
  _type: { type: String, default: 'Job' }
})
const ScraperSchema = new BaseSchema()
const ApprovalSchema = new BaseSchema()

const Job = mongodb.model('Job',JobSchema)
const AgentUpdateJob = Job.discriminator('AgentUpdateJob', AgentUpdateJobSchema)
const ScriptJob = Job.discriminator('ScriptJob', ScriptJobSchema)
const ScraperJob = Job.discriminator('ScraperJob', ScraperSchema)
const ApprovalJob = Job.discriminator('ApprovalJob', ApprovalSchema)

Job.ensureIndexes()
AgentUpdateJob.ensureIndexes()
ScriptJob.ensureIndexes()
ScraperJob.ensureIndexes()
ApprovalJob.ensureIndexes()

exports.Job = Job
exports.AgentUpdate = AgentUpdateJob
exports.Script = ScriptJob
exports.Scraper = ScraperJob
exports.Approval = ApprovalJob

/**
 *
 *
 * Integrations
 *
 *
 */
const NgrokIntegrationJobSchema = require('./integrations/ngrok')
const NgrokIntegrationJob = Job.discriminator('NgrokIntegrationJob', NgrokIntegrationJobSchema)
NgrokIntegrationJob.ensureIndexes()

exports.IntegrationsFactory = {
  create ({ integration, props }) {
    let job = null
    switch (integration) {
      case IntegrationConstants.NGROK:
        job = new NgrokIntegrationJob(props)
        break;
      //default:
      //  ERROR !!!
      //  break
    }
    return job
  }
}
