"use strict";

var appRoot = require('app-root-path');
var lodash = require('lodash');
var config = require('config');
var logger = require(appRoot + '/lib/logger')('eye:service:host:group');

var HostGroup = require(appRoot + '/entity/host/group').Entity;
/** TEMPLATES **/
var ResourceTemplate = require(appRoot + '/entity/resource/template').Entity;
var MonitorTemplate = require(appRoot + '/entity/monitor/template').Entity;
var TaskTemplate = require(appRoot + '/entity/task/template').Entity;
/** NON TEMPLATES **/
var Resource = require(appRoot + '/entity/resource').Entity;
var Monitor = require(appRoot + '/entity/monitor').Entity;
var Task = require(appRoot + '/entity/task').Entity;
var AgentUpdateJob = require(appRoot + '/entity/job/agent-update').Entity;
var elastic = require(appRoot + '/lib/elastic');

exports.Monitor = require('./monitor');

var registerGroupCRUDOperation = function(customer,data){
  var key = config.elasticsearch.keys.template.crud;
  elastic.submit(customer,key,data);
};

/**
 * Remove all group template entities, and
 * unlink all the resources and tasks from the templates.
 *
 * @author Facundo
 */
exports.remove = function(input, doneFn){

  var group = input.group;
  var tasks = group.task_templates;
  var resources = group.resource_templates;
  var monitors = group.monitor_templates;
  var provisioningTasks = group.provisioning_task_templates;

  removeTemplateEntities(tasks     , TaskTemplate     , Task     ); 
  removeTemplateEntities(resources , ResourceTemplate , Resource ); 
  removeTemplateEntities(monitors  , MonitorTemplate  , Monitor  ); 

  group.remove(function(err){
    if(err) return doneFn(err);

    registerGroupCRUDOperation(group.customer_name,{
      'name':group.hostname_regex,
      'customer_name':group.customer_name,
      'user_id':input.user.id,
      'user_email':input.user.email,
      'operation':'delete'
    });
    doneFn();
  });
}

/**
 *
 * create group definition.
 *
 * @param {Object} data , group data properties
 *    @property {Array} tasks
 *    @property {Array} monitors
 *    @property {Array} provtasks , provisioning data
 * @author Facundo
 *
 */
exports.create = function(input, done){
  logger.log('creating group');
  var group;
  var user               = input.user;
  var customer           = input.customer;
  var regex              = input.regex;
  var tasks              = input.tasks;
  var resourcemonitors   = input.resourcemonitors;
  var provisioning_tasks = input.provisioningtasks;

  try {
    group = new HostGroup();
    group.hostname_regex = regex;
    group.customer = customer._id;
    group.customer_name = customer.name;
    group.task_templates = tasks.map(item=>item._id);
    group.monitor_templates = [];
    group.resource_templates = [];
    group.provisioning_task_templates = [];

    resourcemonitors.forEach(template=>{
      group.addMonitorTemplate(template);
    });

    logger.log(group);
  } catch (e) {
    logger.log(e);
  }

  group.save(err => {
    if(err) throw new err;

    registerGroupCRUDOperation(group.customer_name,{
      'name':group.hostname_regex,
      'customer_name':group.customer_name,
      'user_id':input.user.id,
      'user_email':input.user.email,
      'operation':'create'
    });
    done(null,group);
  });
}

exports.searchAndRegisterHostIntoGroup = function(host, next)
{
  logger.log('searching group for host %s', host.hostname);
  HostGroup.find({
    'customer': host.customer_id
  }).exec(function(err, groups){
    for(var i=0; i<groups.length; i++){
      var group = groups[i];
      logger.log('trying group %s', group.hostname_regex);
      if( new RegExp( group.hostname_regex ).test( host.hostname ) === true ){
        logger.log('group found : %s', group.hostname_regex);
        hostProvisioning(host, group, function(err){
          logger.log('provisioning completed');
          if(err) return next(err);
          next(null,group);
        });
        return;
      }
    }
    logger.log('group not found');
    next(null);
  });
}

/**
 *
 * @author Facundo
 * @param {object Host} host
 * @param {object Group} group
 * @param {Function} doneFn
 *
 */
function hostProvisioning(host, group, doneFn)
{
  group.publish({}, function(err,data){
    logger.log('creating resource for host %s', host.hostname);

    var taskTpls = data.tasks;
    var monitorTpls = data.monitors;
    var operations = taskTpls.length + monitorTpls.length;

    if(operations==0){
      logger.log('group is empty. not templates defined');
      return doneFn();
    }

    var completed = lodash.after(operations,function(){
      AgentUpdateJob.create({ host_id: host._id });
      doneFn();
    });

    for(var i=0; i<taskTpls.length; i++){
      var tpl = taskTpls[i];
      logger.log('creating task %s', tpl.name);
      Task.FromTemplate(tpl,{'host':host},(err)=>{
        completed();
      });
    }

    for(var i=0; i<monitorTpls.length; i++){
      var tpl = monitorTpls[i];
      logger.log('creating monitor %s', tpl.name);
      Monitor.FromTemplate(tpl,{'host':host},(err)=>{
        completed();
      });
    }
  });
}

/**
 *
 * @author Facundo
 */
function removeTemplateEntities (
  templates,
  TemplateSchema,
  LinkedSchema
) {
  for(var i=0; i<templates.length; i++){
    var _id = templates[i];

    // remove templates
    TemplateSchema.remove({
      '_id': _id
    }, function(err){
      if(err) return logger.error(err);

      // remove template from linked entities
      var query = LinkedSchema.find({ template: _id });
      query.exec(function(err, entities){
        if(err) return logger.error(err);

        for(var i=0; i<entities.length; i++){
          var entity = entities[i];
          entity.template = null;
          entity.save(function(err){
            if(err) logger.error(err);
          });
        }
      });
    });
  }
}
