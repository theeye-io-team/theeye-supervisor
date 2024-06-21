const util = require('util');
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('../base-schema')
const randomSecret = require('../../lib/random-secret');

function WebhookSchema (specs) {
  const props = {
    name: { type: String, required:true },
    creation_date: { type: Date, default: Date.now },
    last_update: { type: Date, default: null },
    enable: { type: Boolean, default: true },
    customer_id: { type: ObjectId },
    customer: { type: ObjectId, ref: 'Customer' },
    trigger_count: { type: Number, default: 0 },
    // one way hash
    secret: { type: String, 'default': randomSecret }
  }

  // Schema constructor
  BaseSchema.call(this, Object.assign({}, props, specs), {
    collection: 'webhooks',
    discriminatorKey: '_type'
  })

  return this;
}

util.inherits(WebhookSchema, BaseSchema);

module.exports = WebhookSchema;
