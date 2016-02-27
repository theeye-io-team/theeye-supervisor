var mongodb = require("../lib/mongodb");
var Schema = require('mongoose').Schema;

var EntitySchema = Schema({
  name: { type: String, index: true, unique: true, required: true, dropDups: true },
  description: { type: String, 'default': '' },
  emails: { type: Array, 'default': [] },
  config: { type: Object, 'default': {} },
  creation_date: { type: Date, 'default': new Date() }
});

EntitySchema.methods.publish = function(next)
{
  var customer = this;
  return {
    id: customer._id,
    name: customer.name,
    emails: customer.emails,
    description: customer.description,
    config: customer.config,
    creation_date: customer.creation_date
  };
}

var Entity = mongodb.db.model('Customer', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
