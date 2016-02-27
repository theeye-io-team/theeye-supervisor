var _ = require('lodash');
var async = require('async');

var resolver = require('../router/param-resolver');
var validator = require('../router/param-validator');
var logger = require('../lib/logger')('eye:controller:group');
var TaskService = require('../service/task');
var ResourceMonitorService = require('../service/resource/monitor');
var HostGroupService = require('../service/host/group');
var TaskTemplate = require('../entity/task/template').Entity;
var MonitorTemplate = require('../entity/monitor/template').Entity;
var ResourceTemplate = require('../entity/resource/template').Entity;
var HostGroup = require('../entity/host/group').Entity;

/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  server.get('/hostgroup/:group',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.get);

  server.del('/hostgroup/:group',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.remove);

  server.get('/hostgroup',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
  ], controller.fetch);

  server.post('/hostgroup',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
  ], controller.create);
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
var createGroup = function(data, done)
{
  logger.log('creating group');
  var group;
  var customer = data.customer;
  var regex = data.regex;
  var tasks = data.tasks;
  var resourcemonitors = data.resourcemonitors;
  var provisioning_tasks = data.provisioningtasks;

  try {
    group = new HostGroup();
    group.hostname_regex = regex;
    group.customer = customer._id;
    group.customer_name = customer.name;
    group.task_templates = tasks.map(function(item){ return item._id });
    group.monitor_templates = [];
    group.resource_templates = [];
    group.provisioning_task_templates = [];

    for(var i=0; i<resourcemonitors.length; i++) {
      var monitor = resourcemonitors[i].monitor_template;
      var resource = resourcemonitors[i].resource_template;
      group.monitor_templates.push(monitor._id);
      group.resource_templates.push(resource._id);
    }

    logger.log(group);
  } catch (e) {
    logger.log(e);
  }

  group.save(function(err, instance){
    if(err) {
      logger.error(err);
      return done(err);
    }
    // instance has _id set
    done(null, instance);
  });
}

/**
 *
 * @route /group
 * group controller
 * @author Facundo
 *
 */
var controller = {
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  get : function (req,res,next) {
    var group = req.group;
    if(!group) return res.send(400);
    group.publish({}, function(e,g){
      res.send(200, { 'group':g });
    });
  },
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  fetch : function (req,res,next) {
    var customer = req.customer;

    if(!customer) return res.send(400, 'customer required');

    HostGroup.find({ 
      customer_name : customer.name 
    }).exec(function(err,groups){
      if(groups.length == 0){
        return res.send(200,{'groups':[]});
      }
      var pubdata = [];
      var published = _.after(groups.length, function(){
        res.send(200,{ 'groups': pubdata });
      });
      for(var i=0;i<groups.length;i++){
        var group = groups[i];
        group.publish({},function(err,data){
          pubdata.push( data );
          published();
        });
      }
    });
  },
  /**
   *
   * @author Facundo
   * @method POST
   *
   */
  create : function (req,res,next){
    logger.log('group data received %j', req.params);

    var customer = req.customer;
    if(!customer) return res.send(400,'customer required');

    var group = req.params.group;
    if(!group) return res.send(400,'group data required');

    var hostnameregex = group.hostname_regex;
    if(!hostnameregex) return res.send(400,'hostname regexp required');

    var responseError = function(e){
      var errorRes = {
        "error": e.message,
        "info": []
      };
      if(e.info) errorRes.info.push( e.info.toString() );
      res.send( e.statusCode, errorRes );
    }

    async.parallel({
      'tasks' : function(doneFn){
        logger.log('processing group tasks');
        var tasks = group.tasks || [];
        TaskService.tasksToTemplates( 
          tasks,
          req.customer,
          req.user,
          doneFn
        );
      },
      'provtasks' : function(doneFn){
        logger.log('processing group provisioning tasks');
        var provtasks = group.provtasks || [];
        TaskService.tasksToTemplates( 
          provtasks,
          req.customer,
          req.user,
          doneFn
        );
      },
      'resourcemonitors' : function(doneFn){
        logger.log('processing group monitors & resources');
        var monitors = group.monitors || [];

        ResourceMonitorService.resourceMonitorsToTemplates(
          monitors,
          req.customer,
          req.user,
          doneFn
        );
      }
    }, function(error, templates){
      if(error) return responseError(error);
      createGroup({
        'regex': hostnameregex,
        'tasks': templates.tasks,
        'resourcemonitors': templates.resourcemonitors,
        'provisioningtasks': templates.provtasks,
        'customer': req.customer,
      }, function(error, group) {
        if(error) return responseError(error);
        logger.log('group created');
        res.send(200,{ 'group': group });
      });
    });
  },
  /**
   *
   * @author Facundo
   * @method DELETE
   *
   */
  remove : function (req,res,next) {
    var group = req.group;
    if(!group) return res.send(400);
    HostGroupService.removeGroup(group, function(){
      res.send(204);
    });
  },
}
