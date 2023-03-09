
const mongodb = require('../../lib/mongodb').db
const WorkflowSchema = require('./schema')

const Workflow = mongodb.model('Workflow', new WorkflowSchema({}))

exports.Entity = Workflow
exports.Workflow = Workflow
