
const Schema = require('mongoose').Schema

module.exports = {
  order: { type: Number, default: 0 },
  creation_date: { type: Date, default: Date.now },
  last_update: { type: Date, default: Date.now },
  enable: { type: Boolean, default: true },
  customer_id: { type: Schema.Types.ObjectId },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
}
