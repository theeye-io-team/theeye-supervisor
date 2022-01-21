const mongodb = require('../../lib/mongodb').db
//const ObjectId = require('mongoose').Schema.Types.ObjectId
const TaskConstants = require('../../constants/task')
const BaseSchema = require('./schema')

const TaskSchema = new BaseSchema()
const ScraperSchema = require('./scraper')
const ApprovalSchema = require('./approval')
const DummySchema = require('./dummy')
const NotificationSchema = require('./notification')
const ScriptSchema = require('./script')

const Task = mongodb.model('Task', TaskSchema)
const ScriptTask = Task.discriminator('ScriptTask', ScriptSchema)
const ScraperTask = Task.discriminator('ScraperTask', ScraperSchema)
const ApprovalTask = Task.discriminator('ApprovalTask', ApprovalSchema)
const DummyTask = Task.discriminator('DummyTask', DummySchema)
const NotificationTask = Task.discriminator('NotificationTask', NotificationSchema)

Task.ensureIndexes()
ApprovalTask.ensureIndexes()
DummyTask.ensureIndexes()
NotificationTask.ensureIndexes()
ScriptTask.ensureIndexes()
ScraperTask.ensureIndexes()

// called for both inserts and updates
Task.on('afterSave', function(model) {
  model.last_update = new Date();
})

exports.Entity = Task
exports.Task = Task
exports.ScriptTask = ScriptTask
exports.ScraperTask = ScraperTask
exports.ApprovalTask = ApprovalTask
exports.DummyTask = DummyTask
exports.NotificationTask = NotificationTask
