'use strict'

const mongodb = require('../../lib/mongodb')
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

const properties = {
  hostname: { type: String, index: true, required: true },
  customer_name: { type: String, index: true },
  customer_id: { type: String },
  ip: { type: String },
  os_name: { type: String },
  os_version: { type: String },
  agent_version: { type: String },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  enable: { type: Boolean, default: true },
  customer: { type: ObjectId },
  templates: [{ type: ObjectId, ref: 'HostGroup' }] // can belongs to many hostgroups templates
}

const EntitySchema = new Schema(properties)

EntitySchema.methods.publish = (next) => {
  var data = this.toObject()
  if (next) next(data)
  return data
}

// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
  return this._id.toHexString()
})

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

EntitySchema.set('toJSON', specs)
EntitySchema.set('toObject', specs)

const Entity = mongodb.db.model('Host', EntitySchema)
Entity.ensureIndexes()

exports.Entity = Entity
