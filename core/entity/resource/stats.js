var mongodb = require("../../lib/mongodb");
var Schema = require('mongoose').Schema;

var EntitySchema = Schema({
	timestamp   : { type : Date, default : Date.now },
	resource_id : { type : String },
	state       : { type : String }
});

var Entity = mongodb.db.model('ResourceStats', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
