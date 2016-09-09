var mongodb = require('../../lib/mongodb').db;
var BaseSchema = require('./schema');
var Script = require('../script').Entity;

var TemplateSchema = BaseSchema.EntitySchema.extend({
  script_id : { type: String, ref: 'Script' },
  script_arguments : { type: Array, 'default': [] },
  script_runas : { type: String, 'default':'' },
  type: { type: String, 'default': 'script' }
});

TemplateSchema.methods.values = function(){
  var template = this
  return {
		'name': template.name,
		'description': template.description,
		'script_id': template.script_id,
		'script_arguments': template.script_arguments,
  }
}

TemplateSchema.methods.publish = function(done){
  var data = this.toObject();
  if( ! this.script_id ) return done();
  Script.findById(this.script_id, function(err,script){
    if(err||!script) return done(data);
    data.script_name = script.filename;
    done(data);
  });
}

var updateFn = TemplateSchema.methods.update;
TemplateSchema.methods.update = function(input){
  input._type = 'TaskTemplate';
  updateFn.apply(this,arguments);
}

var Entity = mongodb.model('TaskTemplate', TemplateSchema);
Entity.ensureIndexes();
exports.Entity = Entity;
