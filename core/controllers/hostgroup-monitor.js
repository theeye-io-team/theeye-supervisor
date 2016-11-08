'use strict';

var router = require('../router');
var logger = require('../lib/logger')('eye:controller:template:monitor');
var ResourceMonitorService = require('../service/resource/monitor');
var GroupMonitorService = require('../service/host/group').Monitor;

var ResourceTemplate = require('../entity/resource/template').Entity;
var Monitor = require('../entity/monitor').Entity;
var Resource = require('../entity/resource').Entity;
var AgentUpdateJob = require('../entity/job').AgentUpdate;
var Host = require('../entity/host').Entity;
var config = require('config');
var elastic = require('../lib/elastic');

function registerCRUDOperation (customer,data){
  var key = config.elasticsearch.keys.template.monitor.crud;
  elastic.submit(customer,key,data);
}

/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.requireCredential('admin'),
    router.resolve.customerNameToEntity({}),
    router.ensureCustomer,
    router.resolve.idToEntity({
      param: 'group',
      entity: 'host/group',
      required: true
    }),
  ];

  server.get('/:customer/hostgroup/:group/monitortemplate',middlewares,controller.fetch);
  server.post('/:customer/hostgroup/:group/monitortemplate',middlewares,controller.create);
  server.get(
    '/:customer/hostgroup/:group/monitortemplate/:monitortemplate',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'monitortemplate',
        entity: 'monitor/template',
        required: true
      })
    ),
    controller.get
  );
  server.put(
    '/:customer/hostgroup/:group/monitortemplate/:monitortemplate',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'monitortemplate',
        entity: 'monitor/template',
        required: true
      })
    ),
    controller.update
  );
  server.del(
    '/:customer/hostgroup/:group/monitortemplate/:monitortemplate',
    middlewares.concat(
      router.resolve.idToEntity({
        param: 'monitortemplate',
        entity: 'monitor/template',
        required: true
      })
    ),
    controller.remove
  );
}

function validateRequest (req,res) {
  if(!req.group)
    return res.send(404,'group not found');

  if(!req.monitortemplate)
    return res.send(404,'task template not found');

  if(!req.group.hasMonitorTemplate(req.monitortemplate))
    return res.send(400,'task template does not belong to the group');
}

/**
 *
 * searches monitors with this template 
 * and updates those monitors.
 * agents must be notified
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {String} hostregex
 * @param {Function} done
 *
 */
function updateMonitorInstancesOnHostGroups(template, done)
{
  logger.log('updating template monitor "%s"(%s) instances', template.name, template._id);
  done = done || function(){};
  var query = { template: template._id };

  Monitor
  .find(query)
  .exec(function(err, monitors){
    if(err){ logger.error(err); return done(err); }

    if(!monitors || monitors.length==0){
      logger.log('no monitors were found');
      return done();
    }

    for(var i=0; i<monitors.length; i++){
      var monitor = monitors[i];
      var updates = template.values();
      monitor.update(updates,(err)=>{
        if(err) return logger.error(err);
        // notify monitor host agent
        AgentUpdateJob.create({ host_id: monitor.host_id });
      });
    };
    done();
  })
}

/**
 * 
 */
function updateResourceInstancesOnHostGroups(template, done)
{
  logger.log('updating template resource "%s"(%s) instances',
    template.description,
    template._id
  )
  done = done || function(){};
  var query = { template: template._id };

 Resource 
  .find(query)
  .exec(function(err, resources){
    if(err){
      logger.error(err);
      return done(err);
    }

    if(!resources || resources.length==0){
      logger.log('no resources were found');
      return done();
    }

    for(var i=0; i<resources.length; i++){
      var resource = resources[i];
      resource.update(template.values(), function(err){
        if(err) return logger.error(err);

        // notify resource host agent
        AgentUpdateJob.create({ host_id: resource.host_id });
      })
    };
    done();
  })
}


/**
 *
 * endpoint controler definition
 * @author Facundo
 *
 */
var controller = {
  /**
   *
   * @method GET
   *
   */
  get: function(req,res,next){
    validateRequest(req,res);
    var tpl = req.monitortemplate;
    tpl.publish({},function(err,p){
      res.send(200,{ 'monitor': p });
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
      var monitors = data.monitors;
      res.send(200, {'monitors': monitors});
    })
  },
  /**
   *
   * @method POST
   *
   */
  create: function(req,res,next){
    if(!req.group) return res.send(404,'group not found')
    if(!req.body.monitor) return res.send(400,'monitors required')
    var group = req.group;
    var monitors = [ req.body.monitor ];

    ResourceMonitorService.resourceMonitorsToTemplates(
      monitors,
      req.customer,
      req.user,
      function(err,templates){
        if(err) return res.send(err.statusCode, err.message);

        var name = templates[0].monitor_template.name;
        registerCRUDOperation(req.customer.name,{
          'template':req.group.hostname_regex,
          'name':name,
          'customer_name':req.customer.name,
          'user_id':req.user.id,
          'user_email':req.user.email,
          'operation':'create'
        });

        GroupMonitorService.addTemplatesToGroup(
          group, templates, function(err){
            if(err) return res.send(500);
            let template = templates[0].monitor_template;
            res.send(200, { 'monitor': template });
          }
        );
      }
    );
  },
  /**
   *
   * @method PUT
   *
   */
  update: function(req,res,next){
    validateRequest(req,res);
    var monitortemplate = req.monitortemplate;
    var input = req.body.monitor;
    var group = req.group;

    if(!req.group) return res.send(404,'group not found');
    if(!req.monitortemplate) return res.send(404,'monitor not found');
    if(!req.body.monitor) return res.send(400,'invalid request. monitor required');

    input.name||(input.name=input.description);
    input.description||(input.description=input.name);

    monitortemplate.update(input, function(err,qr){
      monitortemplate.populate(function(err){
        var resourcetemplate = monitortemplate.template_resource;
        // updates resource template
        resourcetemplate.update(input,function(err){

          registerCRUDOperation(req.customer.name,{
            'template':req.group.hostname_regex,
            'name':monitortemplate.name,
            'customer_name':req.customer.name,
            'user_id':req.user.id,
            'user_email':req.user.email,
            'operation':'update'
          });
          // looking for monitor with this template
          updateMonitorInstancesOnHostGroups(monitortemplate, function(){
            updateResourceInstancesOnHostGroups(resourcetemplate, function(){
              logger.log('all updates done');
            });
          });
        });
      });

      monitortemplate.publish({}, (err,pub)=>{
        res.send(200, {'monitor': pub}); 
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
    var template = req.monitortemplate;
    var group = req.group;
    GroupMonitorService.removeMonitorTemplateInstancesFromGroupHosts(
      template,
      function(err){
        if(err) return res.send(500);
        removeTemplates(template,err=>{
          if(err) return res.send(500);

          registerCRUDOperation(req.customer.name,{
            'template':req.group.hostname_regex,
            'name':template.name,
            'customer_name':req.customer.name,
            'user_id':req.user.id,
            'user_email':req.user.email,
            'operation':'delete'
          });

          group.detachMonitorTemplate(template);
          res.send(200);
        });
      }
    );
  },
}

function doneError(err,next){
  logger.error(err);
  return next(err); 
}

function removeTemplates (monitorTemplate,doneFn) {
  var rid = monitorTemplate.template_resource;
  ResourceTemplate.findById(rid,function(err,resourceTemplate){
    if(err) return doneError(err,doneFn);
    if(!resourceTemplate) return doneFn();
    logger.log('removing resource template');
    resourceTemplate.remove(err=>{
      if(err) return doneError(err,doneFn);
      logger.log('removing monitor template');
      monitorTemplate.remove(err=>{
        if(err) return doneError(err,doneFn);
        doneFn();
      });
    });
  });
}
