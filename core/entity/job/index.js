'use strict'

const middleware = require('./middleware')
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')
const AgentUpdateJobSchema = require('./agent-update')
const ScriptJobSchema = require('./script')

const jobSchema = new BaseSchema()
jobSchema.post('save', middleware.postSave)

const Job = mongodb.model('Job',jobSchema)
const AgentUpdateJob = Job.discriminator('AgentUpdateJob', AgentUpdateJobSchema)
const ScriptJob = Job.discriminator('ScriptJob', ScriptJobSchema)
const ScraperJob = Job.discriminator('ScraperJob', new BaseSchema())

Job.ensureIndexes()
AgentUpdateJob.ensureIndexes()
ScriptJob.ensureIndexes()
ScraperJob.ensureIndexes()

exports.Job = Job
exports.AgentUpdate = AgentUpdateJob
exports.Script = ScriptJob
exports.Scraper = ScraperJob
