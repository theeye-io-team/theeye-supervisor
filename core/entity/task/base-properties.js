'use strict'
const ObjectId = require('mongoose').Schema.Types.ObjectId
const randomSecret = require('../../lib/random-secret')
module.exports = {
  user_id: { type: String, default: null },
  customer_id: { type: String },
  customer: { type: ObjectId, ref: 'Customer' },
  public: { type: Boolean, default: false },
  tags: { type: Array },
  type: { type: String, required: true },
  name: { type: String },
  description : { type: String },
  triggers: [{ type: ObjectId, ref: 'Event' }],
  acl: [{ type: String }],
  secret: { type: String, default: randomSecret }, // one way hash
  grace_time: { type: Number, default: 0 },
  workflow_id: { type: ObjectId },
  workflow: { type: ObjectId, ref: 'Workflow' }
}
