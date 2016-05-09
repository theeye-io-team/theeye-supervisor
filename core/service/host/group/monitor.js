"use strict";

var appRoot = require('app-root-path');
var Resource = require(appRoot + '/entity/resource').Entity;
var Host = require(appRoot + '/entity/host').Entity;
var Monitor = require(appRoot + '/entity/monitor').Entity;
var Job = require(appRoot + '/entity/job').Entity;
var logger = require(appRoot + '/lib/logger')('eye:service:group:monitor');

exports.addTemplateToGroup = function(group,template,done){
  var monitor_template = template.monitor_template;
  var resource_template = template.resource_template;
  group.monitor_templates.push(monitor_template);
  group.resource_templates.push(resource_template);
  group.save(function(err){
    if(err) logger.error(err);
    addMonitorInstancesToGroupHosts(
      monitor_template,
      group,
      (err)=>{}
    );
    return done(err);
  })
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
exports.removeMonitorTemplateInstancesFromGroupHosts = function(
  template, done
){
  done=done||()=>{};
  logger.log('removing monitor instances');

  removeResourceTemplateInstancesFromGroupHosts(
    {'template':template.template_resource},(err)=>{}
  );

  Monitor
  .find({ 'template':template._id })
  .exec(function(err, monitors){
    if(err){ logger.error(err); return done(err); }

    if(!monitors||monitors.length==0){
      logger.log('no monitors were found');
      return done();
    }

    for(var i=0; i<monitors.length; i++){
      var monitor = monitors[i];
      removeMonitor(monitor);
    }
    done();
  });
}

/**
 *
 * searches hosts which belongs to this group
 * and add the new monitor/resource pair.
 * agents must be notified of the new monitor being added
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {String} hostregex
 * @param {Function} done
 *
 */
function addMonitorInstancesToGroupHosts(
  template, group, done
){
  logger.log('creating monitor instances on group hosts');
  // search for hosts resources linked to the group ...
  Resource.find({
    'type':'host',
    'template':group,
  },(err,resources)=>{
    for(let i=0;i<resources.length;i++){
      let resource=resources[i];
      Host.findById(resource.host_id,(err,host)=>{
        let opts = { 'host': host };
        // ... and attach the new monitor to the host
        Monitor.FromTemplate(template,opts,(err)=>{
          logger.log('monitor created');
          Job.createAgentConfigUpdate(host._id);
        });
      });
    }
  });
}

function removeResourceTemplateInstancesFromGroupHosts(
  template, done
){
  done=done||()=>{};
  Resource.find(template).exec(function(err,resources){
    if(err){ logger.error(err); return done(err); }

    if(!resources||resources.length==0){
      logger.log('no resources were found');
      return done();
    }

    for(var i=0; i<resources.length; i++){
      var resource = resources[i];
      resource.remove(err=>{
        if(err) return logger.error(err);
      });
    }
    done();
  });
};

function removeMonitor(monitor){
  monitor.remove(err=>{
    if(err) return logger.error(err);
    // notify monitor host agent
    Job.createAgentConfigUpdate(monitor.host_id);
  });
}

