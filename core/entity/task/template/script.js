'use strict';

const ObjectId = require('mongoose').Schema.Types.ObjectId
const BaseSchema = require('./schema') // template schema
//const Script = require('../../file').Script

const Schema = new BaseSchema({
  script: { type: ObjectId, ref: 'Script' }, // has one
  script_id: { type: ObjectId }, //has one
  script_arguments: { type: Array, default: () => { return [] } },
  script_runas: { type: String, default: '' },
})

module.exports = Schema

//TemplateSchema.methods.values = function () {
//  var template = this
//  return {
//		name: template.name,
//		description: template.description,
//		script_id: template.script_id,
//		script_arguments: template.script_arguments,
//  }
//}
//
//TemplateSchema.methods.publish = function (done) {
//  var data = this.toObject();
//  if (!this.script_id) return done();
//  Script.findById(this.script_id, function(err,script){
//    if (err||!script) return done(data);
//    data.script_name = script.filename;
//    done(data);
//  });
//}
//
//var updateFn = TemplateSchema.methods.update;
//TemplateSchema.methods.update = function (input) {
//  input._type = 'TaskTemplate';
//  updateFn.apply(this,arguments);
//}
