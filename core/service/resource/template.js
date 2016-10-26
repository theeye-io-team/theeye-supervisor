var debug = require('debug')('service:resource:template');
var MonitorService = require('./monitor');
var ResourceService = require('./index');
var ResourceTemplate = require('../../entity/resource/template').Entity;
var MonitorTemplate = require('../../entity/monitor/template').Entity;
var ResourceMonitor = require('../../entity/monitor').Entity;
var Resource = require('../../entity/resource').Entity;
var _ = require('lodash');

/**
 *
 * turn a monitor and its resource into a template
 *
 * @author Facundo
 *
 */
exports.resourceMonitorToTemplate = function (monitor_id, done) {
  ResourceMonitor.findById(monitor_id, function(err, monitor){
    if(err) throw err;
    if(!monitor){
      var e = new Error('resource monitor not found.');
      e.statusCode = 400;
      return done(e);
    }

    Resource.findById(monitor.resource_id, function(err, resource){
      if(err) throw err;
      if(!resource){
        var e = new Error('resource not found. monitor id ' + monitor_id);
        e.statusCode = 500;
        return done(e);
      }

      monitor.toTemplate(function(err, monTpl){
        resource.toTemplate(function(err,resTpl){
          done(null, {
            'monitor': monTpl,
            'resource': resTpl
          });
        });
      });
    });
  });
}

/**
 *
 * create resource and its monitor from input.
 *
 * @author Facundo
 *
 */
exports.createResourceMonitorsTemplates = function (input, done){
  var resource_data = {
    'type': input.type,
    'customer_id' : input.customer_id,
    'customer_name' : input.customer_name,
    'name' : input.name||input.description,
    'description' : input.description||input.name,
    'user_id' : input.user_id
  }

  MonitorService.setMonitorData(
    input.type,
    input,
    function(err,monitor_data){
      if(err) throw err;
      if(!monitor_data){
        var e = new Error('invalid resource data');
        e.statusCode = 400;
        return next(e);
      }

      delete monitor_data.host_id; // not needed. just in case...

      ResourceTemplate.create(resource_data, function(err, resTpl){
        if(err) return debug(err);

        debug('templates created');
        monitor_data.template_resource = resTpl._id ;
        MonitorTemplate.create(monitor_data, function(err, monTpl){
          done(null,{
            'monitor_template': monTpl, 
            'resource_template': resTpl 
          });
        });
      });
    }
  );
}

