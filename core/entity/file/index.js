'use strict'

const mongodb = require('../../lib/mongodb').db
const FileSchema = require('./schema')
const Template = require('./template')

const ScriptSchema = new FileSchema()
ScriptSchema.statics.create = function (data,next) {
  var options = {
    customer: data.customer_id,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    filename: data.filename,
    keyname: data.keyname,
    mimetype: data.mimetype,
    extension: data.extension,
    size: data.size,
    creation_date: new Date(),
    last_update: new Date(),
    description: (data.description||''),
    md5: data.md5,
    public: data.public
  }

  var script = new Script(options)
  script.save(function(error){
    next(error,script)
  })
}

const File = mongodb.model('File', new FileSchema({
  _type: { type: String, default: 'File' }
}))
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
exports.Script = Script
exports.Template = Template

exports.FactoryCreate = function (data) {
  let _type = data._type

  delete data._type
  delete data._id
  delete data.id
  delete data._v

  if (_type === 'Script' || _type === 'ScriptTemplate') {
    return new Script(data)
  } else if (_type === 'File' || _type === 'FileTemplate' || !_type) {
    return new File(data)
  }

  throw new Error('FATAL ERROR. file _type [' + _type + '] is not valid')
}
