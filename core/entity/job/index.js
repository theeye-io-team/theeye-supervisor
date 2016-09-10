var Schema = require('mongoose').Schema;
require('mongoose-schema-extend');
var ObjectId = Schema.Types.ObjectId;
var mongodb = require('../../lib/mongodb').db;
var debug = require('../../lib/logger')('eye:supervisor:entity:job');

var JobSchema = Schema({
  task_id: { type: String, 'default':null },
  task: { type: Object, 'default':null }, // embedded
  host_id: { type: String, 'default':null },
  host: { type: ObjectId, ref:'Host', 'default':null },
  user_id: { type: String, 'default':null },
  user: { type: ObjectId, ref:'User', 'default':null },
  customer_id: { type:String, 'default':null },
  customer_name: { type : String, 'default':null },
  name: { type: String, 'default':null },
  notify: { type: Boolean, 'default':null },
  state: { type: String, 'default':null },
  result: { type: Object, 'default': {} },
  creation_date: { type: Date, 'default': Date.now },
  last_update: { type: Date, 'default': Date.now },
},{
  collection: 'jobs',
  discriminatorKey: '_type'
});

exports.EntitySchema = JobSchema;

// Duplicate the ID field.
JobSchema.virtual('id').get(function(){
  return this._id.toHexString();
});
const specs = {
	getters: true,
	virtuals: true,
	transform: function (doc, ret, options) {
		// remove the _id of every document before returning the result
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	}
}
JobSchema.set('toJSON', specs);
JobSchema.set('toObject', specs);

var Job = mongodb.model('Job', JobSchema);
Job.ensureIndexes();

exports.Entity = Job;
