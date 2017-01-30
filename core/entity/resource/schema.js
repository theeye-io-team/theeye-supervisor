'use strict';

const Schema = require('mongoose').Schema;
const Constants = require('../../constants/monitors');

var properties = exports.properties = {
  customer_id: { type:String, required:true },
  customer_name: { type:String, required:true },
  description: { type:String, required:true },
  name: { type:String, required:true },
  type: { type:String, required:true },
  user_id: { type:String, 'default': null }, // owner/creator
  acl: [{ type: String }],
  failure_severity: { type: String, default: Constants.MONITOR_SEVERITY_HIGH },
  alerts: { type: Boolean, default: true }
};

/**
 *
 * Schema Definition 
 * 
 **/
var EntitySchema = Schema(properties,{ discriminatorKey : '_type' });
exports.EntitySchema = EntitySchema;


// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
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
EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);
EntitySchema.statics.DEFAULT_TYPE = Constants.RESOURCE_TYPE_DEFAULT ;

EntitySchema.methods.publish = function(next) {
  var data = this.toObject();
  if(next) next(null,data);
  return data;
}
