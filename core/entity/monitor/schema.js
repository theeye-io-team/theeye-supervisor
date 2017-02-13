'use strict';

const Schema = require('mongoose').Schema;
const ObjectId = Schema.Types.ObjectId;
const debug = require('debug')('eye:entity:monitor');
const _ = require('lodash');

if (!RegExp.escape) {
  RegExp.escape = function(s){
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  };
}

/** Schema **/
var EntitySchema = Schema({
  customer_name: { type: String, required: true },
  looptime: { type: Number },
  config: { type: Object, 'default': {} },
  name: { type: String },
  type: { type: String },
  tags: { type: Array, 'default': [] }
},{
  discriminatorKey : '_type'
});
exports.EntitySchema = EntitySchema;

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


/**
 *
 */
EntitySchema.methods.publish = function(options, next) {
  var data = this.toObject();
  if(next) next(null, data);
  return data;
}


EntitySchema.statics.publishAll = function(entities, next){
  if(!entities || entities.length == 0) return next([]);

  var published = [];
  var donePublish = _.after(entities.length, function(){
    next(null, published);
  });

  for(var i = 0; i<entities.length; i++){
    var entity = entities[i];
    entity.publish({},function(error, data){
      published.push(data);
      donePublish();
    });
  }
}

/**
 *
 *
 *
 *
 *
 *
 *    WARNING WARNING
 *
 *   NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
 *
 *
 * THIS IS JUST FOR THE UPDATE PART
 * CREATION IS MADE IN THIS FILE
 *
 * resource/monitor.js
 *
 *
 * UGLY LIKE SHIT I KNOW....
 *
 *
 *
 *
 *
 *
 */
EntitySchema.methods.setUpdates = function(input, next) {
  next=next||function(){};
  var monitor = this;
  var type = monitor.type;
  debug('updating resource monitor type "%s"', type);

  /** set common properties **/
  if (input.looptime) monitor.looptime = input.looptime;
  if (typeof input.enable == 'boolean') monitor.enable = input.enable;
  if (input.host_id) {
    monitor.host = input.host_id;
    monitor.host_id = input.host_id;
  }
  if (input.tags) monitor.tags = input.tags;
  if (input.name) monitor.name = input.name;
  if (input.description) monitor.description = input.description;

  var config = monitor.config;
  if(input.config) _.assign(input, input.config);
  switch(type) {
    case 'scraper':
      //monitor.host_id = input.external_host_id || input.host_id;
      monitor.host_id = input.host_id;
      config.external = Boolean(input.external_host_id);
      config.url = input.url;
      config.timeout = input.timeout;
      config.method = input.method;
      config.json = (input.json=='true'||input.json===true);
      config.gzip = (input.gzip=='true'||input.gzip===true);
      config.parser = input.parser;
      config.status_code = input.status_code;
      config.body = input.body;

      if(input.parser=='pattern'){
        config.pattern = input.pattern;
        config.script = null;
      } else if(input.parser=='script'){
        config.pattern = null;
        config.script = input.script;
      } else {
        config.pattern = null;
        config.script = null;
      }
      break;
    case 'process':
      config.ps.raw_search = input.raw_search;
      config.ps.is_regexp = Boolean(input.is_regexp=='true' || input.is_regexp===true);
      config.ps.pattern = (!config.ps.is_regexp) ? RegExp.escape(input.raw_search) : input.raw_search;
      config.ps.psargs = input.psargs;
      break;
    case 'file':
      config.is_manual_path = input.is_manual_path;
      config.path = input.path;
      config.basename = input.basename;
      config.dirname = input.dirname;
      config.permissions = (input.permissions||'0755');
      config.uid = input.uid;
      config.gid = input.gid;
      config.file = input.file;
      break;
    case 'script':
      if (input.script_id) config.script_id = input.script_id;
      if (input.script_arguments) config.script_arguments = input.script_arguments;
      if (input.script_runas) config.script_runas = input.script_runas;
      break;
    case 'dstat':
      if (input.limit) _.assign(input, input.limit);
      if (input.cpu) config.limit.cpu = input.cpu;
      if (input.mem) config.limit.mem = input.mem;
      if (input.cache) config.limit.cache = input.cache;
      if (input.disk) config.limit.disk = input.disk;
      break;
    case 'host':
    case 'psaux':
      // no custom configuration
      break;
    default: 
      var error = new Error('monitor type "' + type + '" unsupported') ;
      debug(error.message);
      return next(error); 
      break;
  }

  monitor.config = config;
  var updates = {};
  for( var key in monitor.toObject() ){
    if( key != '_id' && key != '__v' )
      updates[key] = monitor[key];
  }

  debug('monitor properties set to %j', updates);

  next(null, updates);
}
