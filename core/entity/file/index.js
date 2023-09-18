const mongodb = require('../../lib/mongodb').db
const FileSchema = require('./schema')
const Template = require('./template')

const ScriptSchema = new FileSchema()

ScriptSchema.statics.create = function (data,next) {
  console.log('file/index script.create DEPRECATED')
  console.log('file/index script.create DEPRECATED')
  console.log('file/index script.create DEPRECATED')

  const options = {
    creation_date: new Date(),
    customer: data.customer_id,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    description: (data.description||''),
    extension: data.extension,
    filename: data.filename,
    keyname: data.keyname,
    last_update: new Date(),
    md5: data.md5,
    mimetype: data.mimetype,
    size: data.size,
  }

  const script = new Script(options)
  script.save(function(error){
    next(error,script)
  })
}

const File = mongodb.model('File', new FileSchema({
  _type: { type: String, default: 'File' }
}))

const Output = File.discriminator('Output', new FileSchema())
const Script = File.discriminator('Script', ScriptSchema)
File.ensureIndexes()

// called for both inserts and updates
File.on('afterSave', function(model) {
  model.last_update = new Date()
  // do more stuff
})

// create event
//File.on('afterInsert',function(model){ });
//File.on('afterUpdate',function(model){ });
//File.on('afterRemove',function(model){ });

exports.File = File
exports.Output = Output
exports.Script = Script
exports.Template = Template

exports.FactoryCreate = function (data) {
  const _type = data._type

  delete data._type
  delete data._id
  delete data.id
  delete data._v

  if (_type === 'Script' || _type === 'ScriptTemplate') {
    return new Script(data)
  } else if (_type === 'Output') {
    return new Output(data)
  } else if (_type === 'File' || _type === 'FileTemplate' || !_type) {
    return new File(data)
  }

  throw new Error('FATAL ERROR. file _type [' + _type + '] is not valid')
}
