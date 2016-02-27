var resolver = require('../router/param-resolver');
var validator = require('../router/param-validator');
var logger = require('../lib/logger')('eye:controller:group-task-template');
var TaskService = require('../service/task');
/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  server.get('/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
  ], controller.get);

  server.del('/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
  ], controller.remove);

  server.put('/hostgroup/:group/tasktemplate/:tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.idToEntity({ param: 'tasktemplate', entity: 'task/template' }),
    resolver.customerNameToEntity({}),
  ], controller.replace);

  server.get('/hostgroup/:group/tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.customerNameToEntity({}),
  ], controller.fetch);

  server.post('/hostgroup/:group/tasktemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.customerNameToEntity({}),
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
  get: function(req,res,next){
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
  fetch: function(req,res,next){
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
  create: function(req,res,next){
    if(!req.group) return res.send(404,'group not found')
    if(!req.body.task) return res.send(400,'tasks required')

    var group = req.group;
    var tasks = [ req.body.task ]
    TaskService.tasksToTemplates( 
      tasks,
      req.customer,
      req.user,
      function(err, templates){
        if(err) return res.send(err.statusCode, err.message)

        var template = templates[0]

        group.task_templates.push( template )
        group.save(function(err){
          if(err) {
            logger.error(err)
            return res.send(500);
          }
          group.publish({}, function(e,g){
            res.send(200, {'task':template})
          });
        })
      }
    )
  },
  /**
   *
   * @method PUT
   *
   */
  replace: function(req,res,next){
    validateRequest(req,res);

    //var group = req.group;
    var task = req.tasktemplate;
    var updates = req.body.task;
    task.update(updates, function(err, task){
      if(err) return res.send(500);
      task.publish(function(pub){
        res.send(200, {'task': pub});
      });
    });
  },
  /**
   *
   * @method DELETE
   *
   */
  remove: function(req,res,next){
    validateRequest(req,res);

    var task = req.tasktemplate;
    task.remove(function(err){
      if(err) res.send(500)
      res.send(200)
    });
  },
}
