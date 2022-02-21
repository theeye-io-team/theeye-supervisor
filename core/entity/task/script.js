const BaseSchema = require('./schema')
const ObjectId = require('mongoose').Schema.Types.ObjectId
const TaskConstants = require('../../constants/task')

const ScriptSchema = new BaseSchema({
  template_id: { type: ObjectId },
  host_id: { type: String },
  type: { type: String, default: 'script' },
  host: { type: ObjectId, ref: 'Host' },
  template: { type: ObjectId, ref: 'TaskTemplate' },
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: { type: Array }, // will be replaced with task_arguments in the future
  script: { type: ObjectId, ref: 'Script' },
  env: { type: Object, default: () => { return {} }},
  logging: { type: Boolean, default: false }
})

module.exports = ScriptSchema

const templateProperties = ScriptSchema.methods.templateProperties

ScriptSchema.methods.templateProperties = function (options) {
  let backup = (options && options.backup)
  if (backup === true) {
    delete values.script_arguments
    return this.toObject()
  }

  const values = templateProperties.apply(this, arguments)
  delete values.script_arguments

  // blank user defined env properties values
  for (let name in values.env) {
    values.env[name] = ''
  }

  for (let name in values.task_arguments) {
    let arg = values.task_arguments[name]
    if (arg.type === TaskConstants.ARGUMENT_TYPE_FIXED) {
      values.task_arguments[name].value = '' // empty value
    }
  }

  values.script_runas = this.script_runas
  //values.script_arguments = values.task_arguments

  return values
}

ScriptSchema.statics.create = function (input, next) {
  var instance = new this()
  const host_id = input.host ? input.host._id : null

  instance.host = host_id
  instance.host_id = host_id
  instance.customer = input.customer._id
  instance.customer_id = input.customer._id
  instance.script_id = input.script._id
  instance.script_arguments = input.script_arguments
  instance.task_arguments = input.task_arguments
  instance.script_runas = input.script_runas
  instance.tags = input.tags
  instance.public = input.public || false
  instance.name = input.name || null
  instance.template = input.template_id || null
  instance.template_id = input.template_id || null
  instance.description = input.description || ''
  instance.save(next)
}
