"use strict";
var _ = require('lodash');
var async = require('async');

var resolver = require('../router/param-resolver');
var validator = require('../router/param-validator');
var logger = require('../lib/logger')('eye:controller:template');
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
  server.get('/:customer/hostgroup/:group',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.get);

  server.get('/:customer/hostgroup',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
  ], controller.fetch);

  server.post('/:customer/hostgroup',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
  ], controller.create);

  server.del('/:customer/hostgroup/:group',[
    passport.authenticate('bearer', {session:false}),
    resolver.customerNameToEntity({}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.remove);
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
  get (req,res,next) {
    var group = req.group;
    if(!group) return res.send(400);
    group.publish({}, (e,g) => {
      res.send(200, { 'group':g });
    });
  },
  /**
   *
   * @author Facundo
   * @method GET
   *
   */
  fetch (req,res,next) {
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
  create (req,res,next){
    logger.log('group data received %j', req.params);

    if(!req.customer) return res.send(400,'customer required');

    var group = req.params.group;
    if(!group) return res.send(400,'group data required');

    var hostnameregex = group.hostname_regex;
    if(!hostnameregex) return res.send(400,'hostname regexp required');

    try {
      new RegExp(hostnameregex);
    } catch(e) {
      return res.send(406,'Invalid regular expression');
    }

    var responseError = (e) => {
      let errorRes = {
        "error": e.message,
        "info": []
      };
      if(e.info) errorRes.info.push( e.info.toString() );
      res.send( e.statusCode, errorRes );
    }

    async.parallel({
      'tasks': (callback) => {
        logger.log('processing group tasks');
        let tasks = group.tasks || [];
        TaskService.tasksToTemplates(
          tasks,
          req.customer,
          req.user,
          callback
        );
      },
      'provtasks': (callback) => {
        logger.log('processing group provisioning tasks');
        let provtasks = group.provtasks || [];
        TaskService.tasksToTemplates(
          provtasks,
          req.customer,
          req.user,
          callback
        );
      },
      'resourcemonitors': (callback) => {
        logger.log('processing group monitors & resources');
        let monitors = group.monitors || [];

        ResourceMonitorService.resourceMonitorsToTemplates(
          monitors,
          req.customer,
          req.user,
          callback
        );
      }
    }, (error, templates) => {
      if(error) return responseError(error);
      HostGroupService.create({
        'user':req.user,
        'regex': hostnameregex,
        'tasks': templates.tasks,
        'resourcemonitors': templates.resourcemonitors,
        'provisioningtasks': templates.provtasks,
        'customer': req.customer,
      },function(error, group){
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
  remove (req,res,next) {
    var group = req.group;
    if(!group) return res.send(400);
    HostGroupService.remove({
      group:group,
      user:req.user,
    },()=>res.send(204));
  },
}
