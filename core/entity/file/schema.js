'use strict'

const util = require('util')
const async = require('async')
const path = require('path')
const BaseSchema = require('../base-schema')
const FetchBy = require('../../lib/fetch-by')
const config = require('config')

function FileSchema (props) {
  props||(props={})

  var specs = { collection: 'files' }
  var properties = {
    customer_id: { type: String },
    customer_name: { type: String },
    user_id: { type: String },
    filename: { type: String },
    keyname: { type: String },
    mimetype: { type: String },
    extension: { type: String },
    size: { type: Number },
    description: { type: String, default:'' },
    md5: { type: String, default: null },
    public : { type: Boolean, default: false },
    tags: { type: Array, default:[] }
  }

  BaseSchema.call(this, util._extend({}, properties, props), specs)

  this.methods.getFullPath = function() {
    const uploadPath = config.get('system').file_upload_folder
    return path.join(
      uploadPath,
      this.customer_name,
      'scripts',
      this.filename
    )
  }

  this.methods.getCleanFilename = function(next) {
    return this.keyname.replace(/\[ts:.*\]/,'')
  }

  this.methods.publish = function(next) {
    var data = this.toObject()
    next(null, data)
    return data
  }

  //this.methods.update = function(updates,next){
  //  for (var prop in updates) {
  //    this[prop] = updates[prop]
  //  }
  //  this.save(err => next(err,this))
  //}

  this.statics.fetchBy = function(filter,next){
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
