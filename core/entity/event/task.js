const Schema = require('mongoose').Schema
const BaseSchema = require('./schema')

const EventSchema = new BaseSchema({
  emitter: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
})

module.exports = EventSchema
