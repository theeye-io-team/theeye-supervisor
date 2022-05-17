
const util = require('util')
const properties = require('./base-properties')
const BaseSchema = require('../base-schema')

function EventSchema (specs) {

  // Schema constructor
  BaseSchema.call(this, Object.assign({}, properties, specs),{
    collection: 'events',
    discriminatorKey: '_type'
  });

  this.statics.fetch = function (query,done) {
    this
      .find(query)
      .select('_id emitter name _type emitter_id')
      .populate({
        path: 'emitter',
        select: '_id name _type type host host_id workflow_id',
        populate: {
          path: 'host',
          select: 'hostname _id'
        }
      }).exec((err, events) => {
        return done(err, events)
      })
  }

  return this
}

util.inherits(EventSchema, BaseSchema)

module.exports = EventSchema
