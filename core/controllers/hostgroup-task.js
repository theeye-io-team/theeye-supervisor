"use strict";

var resolver = require('../router/param-resolver');
var validator = require('../router/param-validator');
var logger = require('../lib/logger')('eye:controller:template:task');
var TaskService = require('../service/task');
var Task = require('../entity/task').Entity;
var Resource = require('../entity/resource').Entity;
var Host = require('../entity/host').Entity;
var Job = require('../entity/job').Entity;
var config = require('config');
var elastic = require('../lib/elastic');

function registerCRUDOperation (customer,data){
  var key = config.elasticsearch.keys.template.task.crud;
  elastic.submit(customer,key,data);
}


/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  server.get('/:customer/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
  ], controller.get);

  server.del('/:customer/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
  ], controller.remove);

  server.put('/:customer/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
  ], controller.replace);

  server.get('/:customer/hostgroup/:group/tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.fetch);

  server.post('/:customer/hostgroup/:group/tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.create);
}

function validateRequest (req,res) {
  if(!req.group)
    return res.send(404,'group not found');

  if(!req.tasktemplate)
    return res.send(404,'task template not found');

  if(!req.group.hasTaskTemplate(req.tasktemplate))
    return res.send(400,'task template does not belong to the group');
}

var controller = {
  /**
   *
   * @method GET
   *
   */
  get (req,res,next){
    validateRequest(req,res);
    var taskTpl = req.tasktemplate;
    taskTpl.publish(function(tpl){
      res.send(200,{ 'task': tpl });
    });
  },
  /**
   *
   * @method GET
   *
   */
  fetch (req,res,next){
    if(!req.group)
      return res.send(404,'group not found');

    var group = req.group;
    group.publish({}, function(err,data){
      var tasks = data.tasks;
      res.send(200, {'tasks': tasks});
    })
  },
  /**
   *
   * @method POST
   *
   */
  create (req,res,next){
    if(!req.group) return res.send(404,'group not found');
    if(!req.body.task) return res.send(400,'tasks required');
    var group = req.group;
    var tasks = [ req.body.task ];

    function addTemplateToGroup(group,template,done){
      group.task_templates.push( template );
      group.save(function(err){
        if(err) logger.error(err);

        logger.log('task added to group');
        addTaskTemplateInstancesToGroupHosts(
          template,
          group,
          (err)=>{}
        );
        return done(err, template);
      });
    }

    TaskService.tasksToTemplates(
      tasks,
      req.customer,
      req.user,
      function(err, templates){
        if(err) return res.send(err.statusCode, err.message);
        let template = templates[0];

        registerCRUDOperation(req.customer.name,{
          'template':group.hostname_regex,
          'name': template.name,
          'customer_name':req.customer.name,
          'user_id':req.user.id,
          'user_email':req.user.email,
          'operation':'create'
        });

        addTemplateToGroup(group,template,(err)=>{
          if(err) return res.send(500);
          res.send(200, {'task':template});
        });
      }
    )
  },
  /**
   *
   * @method PUT
   *
   */
  replace(req,res,next){
    validateRequest(req,res);

    if(!req.group) return res.send(404,'group not found');
    if(!req.tasktemplate) return res.send(404,'task not found');
    if(!req.body.task) return res.send(400,'invalid request. body task required');

    var group = req.group;

    var template = req.tasktemplate;
    var updates = req.body.task;
    template.update(updates,(err)=>{
      if(err) return res.send(500);
      updateTaskInstancesOnHostGroups(template,(err)=>{
        logger.log('all tasks updated');
      });

      registerCRUDOperation(req.customer.name,{
        'template':group.hostname_regex,
        'name':template.name,
        'customer_name':req.customer.name,
        'user_id':req.user.id,
        'user_email':req.user.email,
        'operation':'update'
      });

      template.publish(function(pub){
        res.send(200, {'task': pub});
      });
    });
  },
  /**
   *
   * @method DELETE
   *
   */
  remove(req,res,next){
    validateRequest(req,res);
    var template = req.tasktemplate;
    var group = req.group;
    removeTaskTemplateInstancesFromHostGroups(
      template,
      function(err){
        if(err) res.send(500);
        template.remove(function(err){
          if(err) res.send(500);

          registerCRUDOperation(req.customer.name,{
            'template':group.hostname_regex,
            'name':template.name,
            'customer_name':req.customer.name,
            'user_id':req.user.id,
            'user_email':req.user.email,
            'operation':'delete'
          });

          group.detachTaskTemplate(template);
          res.send(200);
        });
      }
    );
  },
}

function removeTaskTemplateInstancesFromHostGroups(template,done)
{
  done=done||()=>{};
  var query = { 'template': template._id };
  Task.find(query).exec(function(err, tasks){
    if(err){ logger.error(err); return done(err); }

    if(!tasks || tasks.length==0){
      logger.log('tasks not found');
      return done();
    }

    for(var i=0; i<tasks.length; i++){
      var task = tasks[i];
      task.remove(err=>{
        if(err) return logger.error(err);
        // notify monitor host agent
        Job.createAgentConfigUpdate(task.host_id);
      });
    }
    done();
  });
}

/**
 *
 * create a new instance of the task on every host that belongs to this group
 * @author Facugon
 *
 */
function addTaskTemplateInstancesToGroupHosts(
  template, group, done
){
  Resource.find({
    'type':'host',
    'template':group,
  },(err,resources)=>{
    logger.log(resources);
    for(let i=0;i<resources.length;i++){
      let resource=resources[i];
      Host.findById(resource.host_id,(err,host)=>{
        // ... and attach the new task to the host
        let options = { 'host': host };
        Task.FromTemplate(template,options,(err)=>{
          Job.createAgentConfigUpdate(host._id);
        });
      });
    }
  });
}

function updateTaskInstancesOnHostGroups(template, done)
{
  done=done||()=>{};
  var query = { 'template': template._id };
  Task.find(query).exec(function(err,tasks){
    if(err){ logger.error(err); return done(err); }
    if(!tasks || tasks.length==0){
      logger.log('tasks not found');
      return done();
    }
    for(var i=0; i<tasks.length; i++){
      var task = tasks[i];
      task.update(template.values(),err=>{
        if(err) return logger.error(err);
        Job.createAgentConfigUpdate(task.host_id);
      });
    };
    done();
  });
}
