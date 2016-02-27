var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var util = require('util');

function BaseSchema() {
    Schema.apply(this, arguments);
    this.add({
        creation_date : { type : Date , default : Date.now() },
        last_update : { type : Date , default : Date.now() }
    });
};

util.inherits(BaseSchema, Schema);


BaseSchema.pre('save', function() {
    this.last_update = Date.now();
});

BaseSchema.pre('update', function() {
    this.last_update = Date.now();
});

BaseSchema.methods.publish = function(next)
{
    this.id = this._id;
    next(this);
};

BaseSchema.statics.isValidId = function(id)
{
    return id.match( /^[a-fA-F0-9]{24}$/ );
};

BaseSchema.statics.create = function(input,next)
{
    throw new Error('create not implemented');
};

module.exports = BaseSchema;
