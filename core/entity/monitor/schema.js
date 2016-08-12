var Schema = require('mongoose').Schema;
var debug = require('debug')('eye:entity:monitor');
var _ = require('lodash');

/** Entity properties **/
var properties = exports.properties = {
  'customer_name': { type: String, required: true },
  'looptime' : { type: Number },
  'config' : { type: Object, 'default': {} },
  'name' : { type: String },
  'type' : { type: String },
};

/** Schema **/
var EntitySchema = Schema(properties,{ discriminatorKey : '_type' });
exports.EntitySchema = EntitySchema;

/**
 *
 */
EntitySchema.methods.publish = function(options, next)
{
  next = next || function(){};
  var monitor = this;
  var data = {
    'id': monitor._id,
    'name': monitor.name,
    'looptime': monitor.looptime,
    'type': monitor.type,
    'enable': monitor.enable,
    'config': monitor.config
  };

  next(null, data);
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
 */
EntitySchema.methods.setUpdates = function(input, next) {
  next=next||function(){};
  var monitor = this;
  var type = monitor.type;
  debug('updating resource monitor type "%s"', type);

  /** set common properties **/
  if(input.looptime)
    monitor.looptime = input.looptime ;
  if(typeof input.enable != 'undefined')
    monitor.enable = input.enable;
  if(input.host_id)
    monitor.host_id = input.host_id;
  if(input.name || input.description){
    monitor.name = input.name || input.description;
    monitor.description = input.description || input.name;
  }

  var config = monitor.config;
  if(input.config) _.assign(input, input.config);
  switch(type)
  {
    case 'scraper':
      if(
        typeof input.config != 'undefined' && 
        typeof input.config.request_options != 'undefined'
      ) _.assign(input, input.config.request_options);

      monitor.host_id = input.external_host_id || input.host_id;
      config.external = typeof input.external_host_id != 'undefined';
      if(input.pattern ) config.pattern = input.pattern;
      if(input.url     ) config.request_options.url = input.url;
      if(input.timeout ) config.request_options.timeout = input.timeout;
      if(input.method  ) config.request_options.method = input.method;
      break;
    case 'process':
      if(
        typeof input.config != 'undefined' && 
        typeof input.config.ps != 'undefined'
      ) _.assign(input, input.config.ps);

      if(input.pattern) config.ps.pattern = input.pattern;
      if(input.psargs) config.ps.psargs = input.psargs;
      break;
    case 'script':
      if(input.script_id) config.script_id = input.script_id;
      if(input.script_arguments) config.script_arguments = input.script_arguments;
      if(input.script_runas) config.script_runas = input.script_runas;
      break;
    case 'dstat':
      if(
        typeof input.config != 'undefined' && 
        typeof input.config.limit != 'undefined'
      ) _.assign(input, input.config.limit);

      if(input.cpu) config.limit.cpu = input.cpu;
      if(input.mem) config.limit.mem = input.mem;
      if(input.cache) config.limit.cache = input.cache;
      if(input.disk) config.limit.disk = input.disk;
      break;
    case 'psaux':
      // no custom configuration
      break;
    default: 
      return next( new Error('monitor type "' + type + '" unsupported') ); 
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
