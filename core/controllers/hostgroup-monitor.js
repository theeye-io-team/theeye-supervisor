var resolver = require('../router/param-resolver');
var validator = require('../router/param-validator');
var logger = require('../lib/logger')('eye:controller:group-monitor-template');
var ResourceMonitorService = require('../service/resource/monitor');

var ResourceTemplate = require('../entity/resource/template').Entity;
var Monitor = require('../entity/monitor').Entity;
var Resource = require('../entity/resource').Entity;
var Job = require('../entity/job').Entity;
/**
 *
 * exports routes
 * @author Facundo
 *
 */
module.exports = function(server, passport) {
  server.get('/hostgroup/:group/monitortemplate/:monitortemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'monitortemplate', entity: 'monitor/template' }),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.get);

  server.put('/hostgroup/:group/monitortemplate/:monitortemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'monitortemplate', entity: 'monitor/template' }),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.customerNameToEntity({}),
  ], controller.replace);

  server.get('/hostgroup/:group/monitortemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.customerNameToEntity({}),
  ], controller.fetch);

  server.post('/hostgroup/:group/monitortemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
    resolver.customerNameToEntity({}),
  ], controller.create);

  server.del('/hostgroup/:group/monitortemplate/:monitortemplate',[
    passport.authenticate('bearer', {session:false}),
    resolver.idToEntity({ param: 'monitortemplate', entity: 'monitor/template' }),
    resolver.idToEntity({ param: 'group', entity: 'host/group' }),
  ], controller.remove);
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
 * searches hosts which belongs to this group
 * and add the new monitor.
 * agents must be notified of the new monitor being added
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {String} hostregex
 * @param {Function} done
 *
 */
function addMonitorInstancesToGroupHosts(template, hostregex, done){
}

/**
 *
 * searches monitors with this template 
 * and remove those monitors.
 * agents must be notified
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {String} hostregex
 * @param {Function} done
 *
 */
function removeMonitorInstancesFromGroupHosts(template, done){
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
function updateMonitorInstancesOfGroupHosts(template, done)
{
  logger.log('updating template monitor "%s"(%s) instances', template.name, template._id)
  done = done || function(){}
  var query = { template: template._id }

  Monitor
  .find(query)
  .exec(function(err, monitors){
    if(err){
      logger.error(err)
      return done(err)
    }

    if(!monitors || monitors.length==0){
      logger.log('no monitors were found')
      return done()
    }

    for(var i=0; i<monitors.length; i++){
      var monitor = monitors[i]
      monitor.update(template.values(), function(err){
        if(err)
          return logger.error(err)
        // notify monitor host agent
        Job.createAgentConfigUpdate(monitor.host_id)
        logger.log(
          'monitor "%s" agent "%s" notification created',
          monitor.name,
          monitor.host_id
        )
      })
    }
    done()
  })
}

/**
 * 
 */
function updateResourceInstancesOfGroupHosts(template, done)
{
  logger.log('updating template resource "%s"(%s) instances',
    template.description,
    template._id
  )
  done = done || function(){}
  var query = { template: template._id }

 Resource 
  .find(query)
  .exec(function(err, resources){
    if(err){
      logger.error(err)
      return done(err)
    }

    if(!resources || resources.length==0){
      logger.log('no resources were found')
      return done()
    }

    for(var i=0; i<resources.length; i++){
      var resource = resources[i]
      resource.update(template.values(), function(err){
        if(err)
          return logger.error(err)
        // notify resource host agent
        Job.createAgentConfigUpdate(resource.host_id)
        logger.log(
          'resource "%s" agent "%s" notification created',
          resource.name,
          resource.host_id
        )
      })
    }
    done()
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
    tpl.publish({},function(err,tpl){
      res.send(200,{ 'monitor': tpl });
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
    var monitors = [ req.body.monitor ]
    ResourceMonitorService.resourceMonitorsToTemplates(
      monitors,
      req.customer,
      req.user,
      function(err,templates){

        if(err) return res.send(err.statusCode, err.message)

        var monitor_template = templates[0].monitor_template;
        var resource_template = templates[0].resource_template;

        group.monitor_templates.push(monitor_template)
        group.resource_templates.push(resource_template)
        group.save(function(err){
          if(err) {
            logger.error(err)
            return res.send(500);
          }
          group.publish({}, function(e,g){
            res.send(200, {'monitor':monitor_template})
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
    var monitortemplate = req.monitortemplate;
    var input = req.body.monitor;
    var group = req.group;
    
    monitortemplate.update(input, function(err,qr){
      monitortemplate.populate(function(err){
        var resourcetemplate = monitortemplate.template_resource;
        var updates = {
          'name': input.name,
          'description': input.description
        } 
        // updates resource template
        resourcetemplate.update(updates,function(err){
          // looking for monitor with this template
          updateMonitorInstancesOfGroupHosts(monitortemplate, function(){
            updateResourceInstancesOfGroupHosts(resourcetemplate, function(){
              logger.log('all updates done')
            })
          })
        })
      })

      monitortemplate.publish({}, function(err,pub){
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

    var monitor = req.monitortemplate;
    monitor.remove(function(err){
      if(err) res.send(500)
      res.send(200)
    });
  },
}
