
const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');
const afterInsert = require('./afterInsert');
const afterRemove = require('./afterRemove');

const Webhook = mongodb.model('Webhook',
  new BaseSchema({
    _type: { type: String, 'default': 'Webhook' }
  })
);

// called for both inserts and updates
Webhook.on('afterSave', function(model) {
  model.last_update = new Date();
  // do stuff
});

Webhook.on('afterInsert', afterInsert);
Webhook.on('afterRemove', afterRemove);

exports.Webhook = Webhook;
