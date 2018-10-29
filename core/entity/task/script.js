const BaseSchema = require('./schema')
const ObjectId = require('mongoose').Schema.Types.ObjectId

const ScriptSchema = new BaseSchema({
  template_id: { type: ObjectId },
  host_id: { type: String },
  script_id: { type: String },
  script_runas: { type: String },
  script_arguments: { type: Array }, // will be replaced with task_arguments in the future
  type: { type: String, default: 'script' },
  env: { type: Object, default: () => { return {} }},
  // relations
  host: { type: ObjectId, ref: 'Host' },
  script: { type: ObjectId, ref: 'Script' },
  template: { type: ObjectId, ref: 'TaskTemplate' },
})

module.exports = ScriptSchema

const templateProperties = ScriptSchema.methods.templateProperties
ScriptSchema.methods.templateProperties = function () {
  var values = templateProperties.apply(this, arguments)
  values.env = this.env
  values.script_id = this.script_id
  values.script_arguments = this.script_arguments
  values.script_runas = this.script_runas
  values.task_arguments = this.task_arguments
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
  instance.user_id = input.user._id
  instance.tags = input.tags
  instance.public = input.public || false
  instance.name = input.name || null
  instance.template = input.template_id || null
  instance.template_id = input.template_id || null
  instance.description = input.description || ''
  instance.save(next)
}
