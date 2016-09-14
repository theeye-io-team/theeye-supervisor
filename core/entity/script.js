var mongodb = require("../lib/mongodb");
var Schema = require('mongoose').Schema;
var path = require('path');
var config = require("config");
var uploadFolderPath = config.get("system").file_upload_folder ;
var update = require('./update.js');

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
  md5: { type: String, 'default': null },
  public : { type: Boolean, 'default': false },
  tags: { type:Array, 'default':[] }
});

EntitySchema.methods.getFullPath = function() {
  return path.join(
    uploadFolderPath,
    this.customer_name,
    'scripts',
    this.filename
  ) ;
};

EntitySchema.methods.getCleanFilename = function(next) {
  return this.keyname.replace(/\[ts:.*\]/,'');
};

EntitySchema.methods.publish = function(next) {
  var data = this.toObject();
  next(null, data);
  return data;
}

EntitySchema.methods.update = function(props,next){
  return update.call(this, props, next);
}

EntitySchema.statics.create = function(data,next)
{
  var options = {
    "customer_id"   : data.customer._id,
    "customer_name" : data.customer.name,
    "user_id"       : data.user._id,
    "filename"      : data.filename,
    "keyname"       : data.keyname,
    "mimetype"      : data.mimetype,
    "extension"     : data.extension,
    "size"          : data.size,
    "creation_date" : new Date(),
    "last_update"   : new Date(),
    "description"   : data.description || data.filename,
    "md5"           : data.md5,
    "public"        : data.public
  };

  var script = new Entity(options);
  script.save(function(error){
    next(error,script);
  });
};


// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
  return this._id.toHexString();
});
const specs = {
	getters: true,
	virtuals: true,
	transform: function (doc, ret, options) {
		// remove the _id of every document before returning the result
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	}
}
EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);

var Entity = mongodb.db.model('Script', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
