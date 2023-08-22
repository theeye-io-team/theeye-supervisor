const Schema = require('mongoose').Schema
const mongodb = require('../../lib/mongodb').db
const BaseSchema = require('./schema')

const EventSchema = new BaseSchema({
  emitter: {
    type: Schema.Types.ObjectId,
    ref: 'Workflow'
  }
})

module.exports = EventSchema

