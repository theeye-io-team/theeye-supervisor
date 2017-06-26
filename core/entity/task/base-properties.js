'use strict'
const ObjectId = require('mongoose').Schema.Types.ObjectId
const randomSecret = require('../../lib/random-secret')
module.exports = {
  user_id: { type: String, default: null },
  customer_id: { type: String },
  public: { type: Boolean, default: false },
  tags: { type: Array },
  type: { type: String, required: true },
  name: { type: String },
  description : { type: String },
  triggers: [{ type: ObjectId, ref: 'Event' }],
  acl: [{ type: String }],
  // one way hash
  secret: { type: String, default: randomSecret },
  grace_time: { type: Number, default: 0 },
  customer: { type: ObjectId, ref: 'Customer' },
}
