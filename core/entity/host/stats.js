'use strict'

const Schema = require('mongoose').Schema
const mongodb = require('../../lib/mongodb')
const date = new Date()

const EntitySchema = Schema({
	host_id: { type: String },
	customer_name: { type: String, index: true },
	creation_date: { type: Date, default: date },
	last_update: { type: Date, default: date },
	last_update_timestamp: { type: Number, default: date.getTime() },
  type: { type: String },
	stats: {}
})

EntitySchema.statics.create = function (host,type,stats,next) {
  next || (next=()=>{})
  let props = {
    host_id: host._id,
    customer_name: host.customer_name,
    type: type,
    stats: stats
  }

  var entity = new Entity(props)
  entity.save(next)
}

const Entity = mongodb.db.model('HostStats',EntitySchema)
exports.Entity = Entity
