'use strict'

const Schema = require('mongoose').Schema
const BaseSchema = require('./schema')

var EventSchema = new BaseSchema({
  emitter: {
    type: Schema.Types.ObjectId,
    ref: 'Task'
  },
})

module.exports = EventSchema
