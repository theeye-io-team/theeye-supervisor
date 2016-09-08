var JobSchema = require('./index').EntitySchema;
var mongodb = require('../../lib/mongodb').db;

var ScraperJobSchema = JobSchema.extend({
});


var Job = mongodb.model('ScraperJob', ScraperJobSchema);
Job.ensureIndexes();

exports.Entity = Job;
