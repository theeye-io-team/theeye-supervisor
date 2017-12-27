'use strict'

const middleware = require('./middleware')
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')
const AgentUpdateJobSchema = require('./agent-update')
const ScriptJobSchema = require('./script')


const JobSchema = new BaseSchema({
  _type: { type: String, default: 'Job' }
})
const ScraperSchema = new BaseSchema()

//JobSchema.post('save', middleware.postSave)
//ScraperSchema.post('save', middleware.postSave)
//AgentUpdateJobSchema.post('save', middleware.postSave)
//ScriptJobSchema.post('save', middleware.postSave)

const Job = mongodb.model('Job',JobSchema)
const AgentUpdateJob = Job.discriminator('AgentUpdateJob', AgentUpdateJobSchema)
const ScriptJob = Job.discriminator('ScriptJob', ScriptJobSchema)
const ScraperJob = Job.discriminator('ScraperJob', ScraperSchema)

Job.ensureIndexes()
AgentUpdateJob.ensureIndexes()
ScriptJob.ensureIndexes()
ScraperJob.ensureIndexes()

exports.Job = Job
exports.AgentUpdate = AgentUpdateJob
exports.Script = ScriptJob
exports.Scraper = ScraperJob
