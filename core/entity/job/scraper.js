"use strict";

const BaseSchema = require('./schema');
const Job = require('./index');

var ScraperJob = Job.discriminator('ScraperJob', new BaseSchema());
ScraperJob.ensureIndexes();

module.exports = ScraperJob;
