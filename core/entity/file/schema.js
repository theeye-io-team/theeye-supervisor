'use strict'

const util = require('util')
const async = require('async')
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

  this.methods.publish = function (next) {
    var data = this.toObject()
    next(null, data)
    return data
  }

  this.methods.templateProperties = function () {
    let values = {}
    for (let key in SchemaProperties) { values[key] = this[key] }
    values.source_model_id = this._id
    delete values.customer
    delete values.customer_id
    delete values.customer_name
    return values
  }

  this.statics.fetchBy = function (filter, next) {
    var publishedScripts = []
    FetchBy.call(this,filter,function(err,scripts){
      var notFound = (scripts===null||scripts instanceof Array && scripts.length===0)
      if (notFound) {
        next(null,[])
      } else {
        var asyncTasks = []
        scripts.forEach(function(script){
          asyncTasks.push(function(callback){
            script.publish(function(error, data){
              publishedScripts.push(data)
              callback()
            })
          })
        })

        async.parallel(asyncTasks,function(){
          next(null,publishedScripts)
        })
      }
    })
  }

  return this
}

util.inherits(FileSchema, BaseSchema)

module.exports = FileSchema
