"use strict";

var Resource = require('../../../entity/resource').Entity;
var Host = require('../../../entity/host').Entity;
var Monitor = require('../../../entity/monitor').Entity;
var AgentUpdateJob = require('../../../entity/job').AgentUpdate;
var logger = require('../../../lib/logger')('eye:service:group:monitor');
var lodash = require('lodash');
var ResourceService = require('../../../service/resource');

exports.addTemplatesToGroup = function(group,templates,done){
  done||(done=function(){});
  var published = lodash.after(templates.length,()=>done());
  templates.forEach(template=>{
    group.addMonitorTemplate(template);
    addMonitorInstancesToGroupHosts(
      template.monitor_template,
      group,
      err=>published(err)
    );
  });
  group.save();
  return this;
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
  done||(done=function(){});
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

    function removeMonitor(monitor){
      monitor.remove( err => {
        if(err) return logger.error(err);
        // notify monitor host agent
        AgentUpdateJob.create({ host_id: monitor.host_id });
      });
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
  },(err,resources) => {
    if(resources.length==0) return done();
    var created = lodash.after(resources.length,()=>done());
    logger.log('creating %s monitors', resources.length);
    for(let i=0;i<resources.length;i++){
      let resource=resources[i];
      Host.findById(resource.host_id,(err,host)=>{
        if (err) throw err;
        if (!host) throw new Error('host not found');

        // ... and attach the new monitor to the host
        ResourceService.createMonitorFromTemplate({
          template: template.toObject(),
          host: host,
          done: function(){
            logger.log('monitor created');
            created();
            AgentUpdateJob.create({ host_id: host._id });
          }
        });
      });
    }
  });
}

function removeResourceTemplateInstancesFromGroupHosts(
  template, done
){
  done||(done=function(){});
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
