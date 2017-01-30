"use strict";

var mongodb = require("../../lib/mongodb");
var Schema = require('mongoose').Schema;
var debug = require('debug')('eye:entity:host:group');
var _ = require('lodash');

var TaskTemplate = require('../task/template').Entity;
var MonitorTemplate = require('../monitor/template').Entity;

var properties = {
  'customer': { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  'customer_name': { type: String },
  'hostname_regex': { type: String, required: true },
  'task_templates': [{ type: Schema.Types.ObjectId, ref: 'TaskTemplate' }],
  // tasks that will run after new host registration is completed.
  'provisioning_task_templates': [{ type: Schema.Types.ObjectId, ref: 'TaskTemplate' }],
  'resource_templates': [{ type: Schema.Types.ObjectId, ref: 'ResourceTemplate' }],
  'monitor_templates': [{ type: Schema.Types.ObjectId, ref: 'MonitorTemplate' }],
  'enable': { type: Boolean, 'default': true }
};

var EntitySchema = Schema(properties);

/**
 *
 * turn group entity and child objects into a shareable object
 *
 * @author Facundo
 *
 */
EntitySchema.methods.publish = function(options, nextFn) {
  var group = this;
  var nextFn = nextFn || function(){};

  debug('publishing group');
  this.populateAll(function(error){
    if(error) throw error;

    var data = {
      'id' : group._id,
      'customer_name' : group.customer_name,
      'hostname_regex' : group.hostname_regex,
      'tasks' : [],
      'resources' : group.resource_templates,
      'monitors' : group.monitor_templates,
      'provisioning_tasks' : group.provisioning_task_templates,
      'enable': group.enable,
    };

    var total = 0;
    total += group.task_templates.length?1:0;
    total += group.monitor_templates.length?1:0;

    var donePublishing = _.after(total, function(){
      debug('group publishing done');
      nextFn(null,data);
    });

    if(!total) return donePublishing();

    if( group.task_templates.length > 0 ) {
      TaskTemplate.publishAll(
        group.task_templates, 
        function(error, tasks){
          data.tasks = tasks;
          donePublishing();
        }
      );
    }

    if( group.monitor_templates.length > 0 ) {
      MonitorTemplate.publishAll(
        group.monitor_templates, 
        function(error, monitors){
          data.monitors = monitors;
          donePublishing();
        }
      );
    }
  });
}

EntitySchema.methods.populateAll = function(next) {
  Entity.populate(this,[
    { path:'task_templates' },
    { path:'resource_templates' },
    { path:'monitor_templates' },
    { path:'provisioning_task_templates' },
  ],next);
}

/**
 * set templates of one type.
 * @author Facundo
 * @param {Array} tpls , template instances array
 * @param {String} prop , name of the templates group property to set
 * @return this
 */
EntitySchema.methods.setTemplatesProperty = function(prop, tpls){
  var group = this;
  if(!tpls || (tpls instanceof Array && tpls.length == 0))
    return doneFn(new Error('invalid templates values'));

  if(!prop || !group.toObject().hasOwnProperty(prop))
    return doneFn(new Error('invalid templates property'));

  for(var i=0; i<tpls.length; i++){
    group[ prop ].push( tpls[i] );
  }

  return group;
}

EntitySchema.methods.detachTaskTemplate = function(template,done)
{
  done||(done=function(){});

  var task = template._id;
  Entity.update(this,{
    $pullAll: { task_templates: [ task ] },
  }, (err) => {
    done();
  });
}

EntitySchema.methods.detachMonitorTemplate = function(template,done){
  done||(done=function(){});

  function deleteMonitorTemplate(id,next){
    Entity.update(this,{
      $pullAll: { 'monitor_templates': [ id ] },
    }, next);
  }

  function deleteResourceTemplate(id,next){
    Entity.update(this,{
      $pullAll: { 'resource_templates': [ id ] }
    }, next);
  }

  let monitor = template._id;
  deleteMonitorTemplate(monitor,(err)=>{
    if(err) return done(err);
    let resource = template.template_resource;
    deleteResourceTemplate(resource,(err)=>{
      if(err) return done(err);
      done();
    });
  });
}

EntitySchema.methods.addMonitorTemplate = function(template){
  var monitor_template = template.monitor_template;
  var resource_template = template.resource_template;
  this.monitor_templates.push(monitor_template);
  this.resource_templates.push(resource_template);
  return this;
}

EntitySchema.methods.hasTaskTemplate = function(task){
  return this.task_templates.indexOf(task._id) != -1;
}

EntitySchema.methods.hasMonitorTemplate = function(monitor){
  return this.monitor_templates.indexOf(monitor._id) != -1;
}

var Entity = mongodb.db.model('HostGroup', EntitySchema)
Entity.ensureIndexes();

exports.EntitySchema = EntitySchema;
exports.Entity = Entity;
