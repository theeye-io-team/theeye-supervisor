'use strict'

const mongodb = require('../../lib/mongodb')
const BaseSchema = require('./schema')

const HostSchema = new BaseSchema({})

HostSchema.methods.publish = (next) => {
  var data = this.toObject()
  if (next) next(data)
  return data
}

const Entity = mongodb.db.model('Host', HostSchema)
Entity.ensureIndexes()

exports.Entity = Entity
exports.Host = Entity
