"use strict";

const BaseSchema = require('./schema');
const mongodb = require('../../lib/mongodb').db;

const Job = mongodb.model('Job', new BaseSchema());
Job.ensureIndexes();

module.exports = Job ;
