const mongodb = require('../../lib/mongodb').db
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
exports.ScriptTask = ScriptTask
exports.ScraperTask = ScraperTask
exports.ApprovalTask = ApprovalTask
exports.DummyTask = DummyTask
exports.NotificationTask = NotificationTask

exports.Factory = {
  create (input) {
    if (input.type == TaskConstants.TYPE_SCRAPER) {
      input._type = 'ScraperTask'
      return new ScraperTask(input)
    }

    if (input.type == TaskConstants.TYPE_APPROVAL) {
      input._type = 'ApprovalTask'
      return new ApprovalTask(input)
    }

    if (input.type == TaskConstants.TYPE_DUMMY) {
      input._type = 'DummyTask'
      return new DummyTask(input)
    }

    if (input.type == TaskConstants.TYPE_NOTIFICATION) {
      input._type = 'NotificationTask'
      if (
        !Array.isArray(input.task_arguments) ||
        input.task_arguments.length === 0
      ) {
        delete input.task_arguments
      }
      return new NotificationTask(input)
    }

    if (input.type == TaskConstants.TYPE_SCRIPT) {
      input._type = 'ScriptTask'
      return new ScriptTask(input)
    }

    throw new Error('invalid error type ' + input.type)
  }
}
