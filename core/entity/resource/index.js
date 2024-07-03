const m2s = require('mongoose-to-swagger');
const mongodb = require('../../lib/mongodb').db
const ResourceSchema = require('./base')

const Resource = mongodb.model('Resource', ResourceSchema)
Resource.ensureIndexes()

exports.Resource = Resource
exports.Entity = Resource

exports.swagger = {
  components: {
    schemas: {
      Resource: m2s(Resource)
    }
  }
}
