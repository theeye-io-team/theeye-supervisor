"use strict";

const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');
const AgentUpdateJobSchema = require('./agent-update');
const ScriptJobSchema = require('./script');

const Job = mongodb.model('Job', new BaseSchema());
Job.ensureIndexes();

const AgentUpdateJob = Job.discriminator('AgentUpdateJob', AgentUpdateJobSchema);
AgentUpdateJob.ensureIndexes();

const ScriptJob = Job.discriminator('ScriptJob', ScriptJobSchema);
ScriptJob.ensureIndexes();

const ScraperJob = Job.discriminator('ScraperJob', new BaseSchema());
ScraperJob.ensureIndexes();

exports.Job = Job ;

exports.AgentUpdate = AgentUpdateJob;

exports.Script = ScriptJob;

exports.Scraper = ScraperJob;
