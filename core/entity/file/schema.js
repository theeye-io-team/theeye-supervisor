
const util = require('util')
const path = require('path')
const config = require('config')
const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('../base-schema')
const SchemaProperties = require('./schema-properties')
const FetchBy = require('../../lib/fetch-by')

function FileSchema (props) {
  props||(props={})

  var specs = { collection: 'files' }

  BaseSchema.call(
    this,
    Object.assign(
      {
        template_id: { type: ObjectId },
        template: { type: ObjectId, ref: 'FileTemplate' },
      },
      SchemaProperties,
      props
    ),
    specs
  )

  this.methods.getFullPath = function () {
    const uploadPath = config.get('system').file_upload_folder
    return path.join(
      uploadPath,
      this.customer_name,
      'scripts',
      this.filename
    )
  }

  this.methods.getCleanFilename = function (next) {
    return this.keyname.replace(/\[ts:.*\]/,'')
  }

  this.methods.templateProperties = function () {
    let values = this.toObject()

    values.source_model_id = this._id
    // remove non essential properties
    delete values.id
    delete values._id
    delete values.creation_date
    delete values.last_update
    delete values.template
    delete values.template_id
    delete values.enable
    delete values.keyname
    delete values.customer
    delete values.customer_id
    delete values.customer_name
    return values
  }

  return this
}

util.inherits(FileSchema, BaseSchema)

module.exports = FileSchema
