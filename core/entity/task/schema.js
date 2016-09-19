"use strict";

require('mongoose-schema-extend');
var debug = require('debug')('eye:supervisor:entity:task');
var Schema = require('mongoose').Schema;
var lodash = require('lodash');

/** Entity properties **/
const properties = exports.properties = {
  creation_date : { type: Date, 'default': Date.now() },
  last_update : { type: Date, 'default': Date.now() },
  name : { type: String },
  description : { type: String },
  user_id : { type: String, 'default': null },
  customer_id : { type: String, 'default': null },
  public : { type: Boolean, 'default': false },
  tags: { type: Array, 'default':[] },
  type: { type: String, required: true },
  triggers: [{ type: Schema.Types.ObjectId, ref: 'Event', 'default':function(){return [];} }],
  grace_time: { type: Number, 'default': 0 }
};

/** Schema **/
var EntitySchema = new Schema(properties);
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
		//delete ret._type;
		delete ret.__v;
	}
}
EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);

/**
 *
 *
 *
 */
EntitySchema.methods.update = function(input,next)
{
  var task = this ;
  var data = task.toObject();
  for(var key in input){
    if( data.hasOwnProperty(key) ) {
      task[key] = input[key];
    }
  };

  debug('saving task %j', task);
  task.save(function(error){
    if(error) return next(error);
    next(null, task);
  });
}

/**
 *
 *
 *
 */
EntitySchema.statics.create = function(input,next)
{
  var instance = new this();
  instance.user_id = input.user_id||input.user._id;
  instance.customer_id = input.customer_id||input.customer._id;
  instance.script_id = input.script_id||input.script._id;
  instance.script_arguments = input.script_arguments;
  instance.script_runas = input.script_runas;
  instance.name = input.name || null;
  instance.description = input.description || null;
  instance.tags = input.tags;
  instance.save(function(error,entity){
    next(null, entity);
  });
}

EntitySchema.statics.publishAll = function(entities, next){
  if(!entities||entities.length==0) return next([]);

  var published = [];
  var donePublish = lodash.after(entities.length, function(){
    next(null, published);
  });

  for(var i = 0; i<entities.length; i++){
    var entity = entities[i];
    entity.publish(function(data){
      published.push(data);
      donePublish();
    });
  }
}
