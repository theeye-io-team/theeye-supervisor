const mongodb = require('../../lib/mongodb').db
const ResourceSchema = require('./base')

const Resource = mongodb.model('Resource', ResourceSchema)

exports.Resource = Resource
exports.Entity = Resource
