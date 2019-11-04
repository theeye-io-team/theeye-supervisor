const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema')

const DummySchema = new BaseSchema({
  template_id: { type: ObjectId },
  template: { type: ObjectId, ref: 'DummyTaskTemplate' },
  type: { type: String, default: 'dummy' },
  always_hold: { type: Boolean, default: false }
})

module.exports = DummySchema
