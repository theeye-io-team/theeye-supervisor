var Schema = require('mongoose').Schema;
var _ = require('lodash');
var logger = require('../../lib/logger')('eye:service:host:group');

var HostGroup = require('../../entity/host/group').Entity;
/** TEMPLATES **/
var ResourceTemplate = require('../../entity/resource/template').Entity;
var MonitorTemplate = require('../../entity/monitor/template').Entity;
var TaskTemplate = require('../../entity/task/template').Entity;
/** NON TEMPLATES **/
var Resource = require('../../entity/resource').Entity;
var Monitor = require('../../entity/monitor').Entity;
var Task = require('../../entity/task').Entity;
var Job = require('../../entity/job').Entity;

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


/**
 * Remove all group template entities, and
 * unlink all the resources and tasks from the templates.
 *
 * @author Facundo
 */
exports.removeGroup = function(group, doneFn){
  var tasks = group.task_templates;
  var resources = group.resource_templates;
  var monitors = group.monitor_templates;
  var provisioningTasks = group.provisioning_task_templates;

  removeTemplateEntities(tasks     , TaskTemplate     , Task     ); 
  removeTemplateEntities(resources , ResourceTemplate , Resource ); 
  removeTemplateEntities(monitors  , MonitorTemplate  , Monitor  ); 

  group.remove(function(err){
  });

  doneFn();
  return;
}

exports.searchAndRegisterHostIntoGroup = function(host, next) {
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
          if(err) return next(err);
          next(null,group);
        });
        break;
      }
    }
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
function hostProvisioning( host, group, doneFn )
{
  group.publish({}, function(err,data){
    logger.log('creating resource for host %s', host.hostname);

    var taskTpls = data.tasks;
    var monitorTpls = data.monitors;
    var operations = taskTpls.length + monitorTpls.length;

    var completed = _.after(operations,function(){
      Job.createAgentConfigUpdate(host._id);
      doneFn();
    });

    for(var i=0; i<taskTpls.length; i++){
      var tpl = taskTpls[i];
      logger.log('creating task %s', tpl.name);
      Task.FromTemplate(tpl,{ 'host': host },function(err){
        completed();
      });
    }

    for(var i=0; i<monitorTpls.length; i++){
      var tpl = monitorTpls[i];
      logger.log('creating monitor %s', tpl.name);
      Monitor.FromTemplate(tpl,{ 'host': host },function(err){
        completed();
      });
    }
  });
}
