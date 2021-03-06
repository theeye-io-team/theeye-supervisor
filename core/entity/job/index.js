const mongodb = require('../../lib/mongodb').db
const IntegrationConstants = require('../../constants/integrations')
const BaseSchema = require('./schema')
const AgentUpdateSchema = require('./agent-update')
const WorkflowSchema = require('./workflow')

const ScriptSchema = require('./script')
const ScraperSchema = require('./scraper')
const JobSchema = new BaseSchema({
  _type: { type: String, default: 'Job' }
})
//const ApprovalSchema = new BaseSchema()
const ApprovalSchema = require('./approval')
const DummySchema = new BaseSchema()
const NotificationSchema = new BaseSchema()

const Job = mongodb.model('Job', JobSchema)
const AgentUpdateJob = Job.discriminator('AgentUpdateJob', AgentUpdateSchema)
const ScriptJob = Job.discriminator('ScriptJob', ScriptSchema)
const ScraperJob = Job.discriminator('ScraperJob', ScraperSchema)
const ApprovalJob = Job.discriminator('ApprovalJob', ApprovalSchema)
const DummyJob = Job.discriminator('DummyJob', DummySchema)
const NotificationJob = Job.discriminator('NotificationJob', NotificationSchema)
const WorkflowJob = Job.discriminator('WorkflowJob', WorkflowSchema)

Job.ensureIndexes()
AgentUpdateJob.ensureIndexes()
ScriptJob.ensureIndexes()
ScraperJob.ensureIndexes()
ApprovalJob.ensureIndexes()
DummyJob.ensureIndexes()
NotificationJob.ensureIndexes()
WorkflowJob.ensureIndexes()

exports.Job = Job
exports.AgentUpdate = AgentUpdateJob
exports.Script = ScriptJob
exports.Scraper = ScraperJob
exports.Approval = ApprovalJob
exports.Dummy = DummyJob
exports.Notification = NotificationJob
exports.Workflow = WorkflowJob

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
