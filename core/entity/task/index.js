const mongodb = require('../../lib/mongodb').db
const m2s = require('mongoose-to-swagger');
const fs = require('fs')
const TaskConstants = require('../../constants/task')
const BaseSchema = require('./schema')

const TaskSchema = new BaseSchema()
const ScraperSchema = require('./scraper')
const ApprovalSchema = require('./approval')
const DummySchema = require('./dummy')
const NotificationSchema = require('./notification')
const ScriptSchema = require('./script')
const NodejsSchema = require('./nodejs')

const Task = mongodb.model('Task', TaskSchema)
const ScriptTask = Task.discriminator('ScriptTask', ScriptSchema)
const NodejsTask = Task.discriminator('NodejsTask', NodejsSchema)
const ScraperTask = Task.discriminator('ScraperTask', ScraperSchema)
const ApprovalTask = Task.discriminator('ApprovalTask', ApprovalSchema)
const DummyTask = Task.discriminator('DummyTask', DummySchema)
const NotificationTask = Task.discriminator('NotificationTask', NotificationSchema)

const swaggermodels = {
  components: {
    schemas: {
      Task: m2s(Task),
      ScriptTask: m2s(ScriptTask),
      ScraperTask: m2s(ScraperTask),
      ApprovalTask: m2s(ApprovalTask),
      DummyTask: m2s(DummyTask),
      NotificationTask: m2s(NotificationTask)
    }      
  }
}

// fs.writeFileSync('swagger.json', JSON.stringify(swaggermodels))

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
exports.NodejsTask = NodejsTask
exports.ScriptTask = ScriptTask
exports.ScraperTask = ScraperTask
exports.ApprovalTask = ApprovalTask
exports.DummyTask = DummyTask
exports.NotificationTask = NotificationTask

const ClassesMap = {}
ClassesMap[ TaskConstants.TYPE_SCRIPT ] = function (input) {
  let task = new ScriptTask(input)
  if (input.script_runas) {
    task.script_runas = input.script_runas
    if (/%script%/.test(input.script_runas) === false) {
      task.script_runas += ' %script%'
    }
  }
  return task
}
ClassesMap[ TaskConstants.TYPE_NOTIFICATION ] = function (input) {
  if (
    !Array.isArray(input.task_arguments) ||
    input.task_arguments.length === 0
  ) {
    delete input.task_arguments
  }
  return new NotificationTask(input)
}
ClassesMap[ TaskConstants.TYPE_NODEJS ] = NodejsTask
ClassesMap[ TaskConstants.TYPE_SCRAPER ] = ScraperTask
ClassesMap[ TaskConstants.TYPE_APPROVAL ] = ApprovalTask
ClassesMap[ TaskConstants.TYPE_DUMMY ] = DummyTask

exports.Factory = {
  create (input) {
    delete input._type
    delete input.creation_date
    delete input.last_update
    delete input.secret
    input.customer = input.customer_id

    if (input.hasOwnProperty('allows_dynamic_settings') === false) {
      input.allows_dynamic_settings = false
    }

    if (ClassesMap.hasOwnProperty(input.type)) {
      return new ClassesMap[input.type](input)
    }
    throw new Error('invalid error type ' + input.type)
  }
}
