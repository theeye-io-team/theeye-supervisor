'use strict';

const util = require('util');
const Schema = require('mongoose').Schema;
const async = require('async');
const BaseSchema = require('../base-schema');
const path = require('path');

const config = require('config');

function FileSchema (props) {
  props||(props={});

  var specs = {
    collection:'files'
  };
  var properties = {
    customer_id: { type: String },
    customer_name: { type: String },
    user_id: { type: String },
    filename: { type: String },
    keyname: { type: String },
    mimetype: { type: String },
    extension: { type: String },
    size: { type: Number },
    description: { type: String, 'default' : '' },
    md5: { type: String, 'default': null },
    public : { type: Boolean, 'default': false },
    tags: { type:Array, 'default':[] }
  }

  BaseSchema.apply(this, util._extend({},properties, props), specs);

  this.methods.getFullPath = function() {
    const uploadPath = config.get('system').file_upload_folder;
    return path.join(
      uploadPath,
      this.customer_name,
      'scripts',
      this.filename
    );
  }

  this.methods.getCleanFilename = function(next) {
    return this.keyname.replace(/\[ts:.*\]/,'');
  }

  this.methods.publish = function(next) {
    var data = this.toObject();
    next(null, data);
    return data;
  }

  this.methods.update = function(props,next){
    for( var prop in updates ) {
      this[prop] = updates[prop];
    }
    this.save( err => next(err) );
  }

  return this;
}

util.inherits(FileSchema,BaseSchema);

module.exports = FileSchema;
