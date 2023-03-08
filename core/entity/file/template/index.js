const mongodb = require('../../../lib/mongodb').db
const ObjectId = require('mongoose').Schema.Types.ObjectId

const TemplateSchema = require('./schema') // base file

const FileTemplate = mongodb.model('FileTemplate', new TemplateSchema())
const ScriptTemplate = FileTemplate.discriminator('ScriptTemplate', new TemplateSchema({}))

// called for both inserts and updates
FileTemplate.on('beforeSave', function (model) {
  model.last_update = new Date()
  // do more stuff
})

exports.File = FileTemplate
exports.Script = ScriptTemplate

exports.FactoryCreate = function (data) {
  let _type = data._type

  delete data._type
  delete data._id
  delete data.id
  delete data._v

  if (_type === 'Script' || _type === 'ScriptTemplate') {
    return new ScriptTemplate(data)
  } else if (_type === 'File' || _type === 'FileTemplate' || !_type) {
    return new FileTemplate(data)
  }

  throw new Error('FATAL ERROR. file _type [' + _type + '] is not valid')
}
