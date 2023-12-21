const mongodb = require('../../lib/mongodb').db
const IntegrationConstants = require('../../constants/integrations')
const BaseSchema = require('./schema')
const AgentUpdateSchema = require('./agent-update')
const WorkflowSchema = require('./workflow')

const ScriptSchema = require('./script')
const NodejsSchema = require('./nodejs')
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
const NodejsJob = Job.discriminator('NodejsJob', NodejsSchema)
const ScraperJob = Job.discriminator('ScraperJob', ScraperSchema)
const ApprovalJob = Job.discriminator('ApprovalJob', ApprovalSchema)
const DummyJob = Job.discriminator('DummyJob', DummySchema)
const NotificationJob = Job.discriminator('NotificationJob', NotificationSchema)
const WorkflowJob = Job.discriminator('WorkflowJob', WorkflowSchema)

exports.Job = Job
exports.AgentUpdate = AgentUpdateJob
exports.Script = ScriptJob
exports.Nodejs = NodejsJob
exports.Scraper = ScraperJob
exports.Approval = ApprovalJob
exports.Dummy = DummyJob
exports.Notification = NotificationJob
exports.Workflow = WorkflowJob
