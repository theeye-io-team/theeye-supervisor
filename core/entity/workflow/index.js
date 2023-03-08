'use strict'

const mongodb = require('../../lib/mongodb').db
const WorkflowSchema = require('./schema')

const Workflow = mongodb.model('Workflow', new WorkflowSchema({}))

// called for both inserts and updates
Workflow.on('afterSave', function(model) {
  model.last_update = new Date()
  // do more stuff
})

exports.Entity = Workflow
exports.Workflow = Workflow
