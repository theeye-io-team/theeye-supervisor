var mongodb = require("../lib/mongodb");
var Schema = require('mongoose').Schema;
var path = require('path');
var config = require("config");
var uploadFolderPath = config.get("system").file_upload_folder ;

var EntitySchema = Schema({
  customer_id: { type: String },
  customer_name: { type: String },
  user_id: { type: String },
  filename: { type: String },
  keyname: { type: String },
  mimetype: { type: String },
  extension: { type: String },
  size: { type: Number },
  creation_date: { type: Date, 'default': Date.now },
  last_update: { type: Date, 'default': Date.now },
  description: { type: String, 'default' : '' },
  md5: { type: String, 'default': null }
});

EntitySchema.methods.getFullPath = function() {
  return path.join(
    uploadFolderPath, 
    this.customer_name, 
    'scripts', 
    this.filename
  ) ;
}

EntitySchema.methods.getCleanFilename = function(next) {
  return this.keyname.replace(/\[ts:.*\]/,'');
}

EntitySchema.methods.publish = function(next) {
  var script = this;
  var data = {
    id : script._id,
    filename : script.filename,
    description : script.description,
    mimetype : script.mimetype,
    extension : script.extension,
    size : script.size,
    md5 : script.md5
  };

  return next(null, data);
}

EntitySchema.methods.update = function(input,next) {
  var script = this;
  script.last_update = new Date();
  script.description = input.description;
  script.keyname = input.keyname; // name.extension + [ts:########]
  script.inputname = input.name;
  script.mimetype = input.mimetype;
  script.size = input.size;
  script.extension = input.extension;
  script.md5 = input.md5;

  script.save(function(error){
    if(error) return next(error);
    if(next) return next(null,script);
  });
}

EntitySchema.statics.create = function(data,next)
{
  var options = {
    "customer_id"   : data.customer._id,
    "customer_name" : data.customer.name,
    "user_id"       : data.user._id,
    "filename"      : data.filename,
    "keyname"       : data.keyname, // name + [ts:########] + .extension
    "mimetype"      : data.mimetype,
    "extension"     : data.extension,
    "size"          : data.size,
    "creation_date" : new Date(),
    "last_update"   : new Date(),
    "description"   : data.description || data.filename,
    "md5"           : data.md5,
  };

  var script = new Entity(options);
  script.save(function(error){
    next(error,script);
  });
}

var Entity = mongodb.db.model('Script', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;

