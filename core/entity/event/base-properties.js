const randomSecret = require('../../lib/random-secret')
const Schema = require('mongoose').Schema

module.exports = {
  name: { type: String },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  enable: { type: Boolean, default: true },
  secret: { type: String, default: () => { return randomSecret() } },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customer_id: { type: Schema.Types.ObjectId },
  emitter_id: { type: Schema.Types.ObjectId },
  emitter_prop: { type: String },
  emitter_value: { type: String }
}
