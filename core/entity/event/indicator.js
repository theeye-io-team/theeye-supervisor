const Schema = require('mongoose').Schema
const BaseSchema = require('./schema')

const EventSchema = module.exports = new BaseSchema({
  emitter: {
    type: Schema.Types.ObjectId,
    ref: 'Indicator'
  }
})
