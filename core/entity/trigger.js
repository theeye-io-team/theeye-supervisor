var mongodb = require('../lib/mongodb');
var Schema = require('mongoose').Schema;

var properties = {
    resource_id : { type : String },
    task_id : { type : String },
    resource_state : { type : String },
    operating_mode : { type : String, default: 'normal' },
    description : { type : String, default : '' },
    creation_date : { type : Date , default : Date.now() },
    last_update : { type : Date , default : Date.now() }
};

var EntitySchema = Schema(properties);

EntitySchema.methods.publish = function(next)
{
    next({
        id : this._id,
        resource_id : this.resource_id,
        task_id : this.task_id,
        resource_state : this.resource_state,
        operating_mode : this.operating_mode,
        description : this.description
    });
};

EntitySchema.statics.create = function(input,next)
{
    var trigger = new this();
    trigger.resource_id = input.resource._id;
    trigger.task_id = input.task._id;
    trigger.resource_state = input.resource_state;
    trigger.description = input.description;
    trigger.operating_mode = input.operating_mode;
    trigger.save();

    if(next) next(null,trigger);
};

var Entity = mongodb.db.model('Trigger', EntitySchema);
Entity.ensureIndexes();

exports.Entity = Entity;
