
const mongodb = require('../../lib/mongodb').db;
const BaseSchema = require('./schema');

const Webhook = mongodb.model('Webhook',
  new BaseSchema({
    _type: { type: String, 'default': 'Webhook' }
  })
);

exports.Webhook = Webhook;
