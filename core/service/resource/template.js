var debug = require('debug')('eye:supervisor:service:resource:template');
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
    'name' : input.name,
    'description' : input.description,
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

/**
 *
 * @author Facundo
 * @param {object MonitorTemplate} template
 * @param {Object} options
 * @param {Function} doneFn
 *
 */
exports.createMonitorFromTemplate = function(options) {

  var doneFn = ( options.done||(function(){}) ),
    template = options.template,
    host = options.host;

  MonitorTemplate.populate(template,{
    path: 'template_resource' 
  },function(err,monitorTemplate){
    var resourceTemplate = monitorTemplate.template_resource;
    var options = { 'host': host };
    Resource.FromTemplate(
      resourceTemplate,
      options,
      function(err,resource){
        if(err) {
          debug('Resorce creation error %s', err.message);
          return doneFn(err);
        }

        var props = _.extend( template, {
          host: options.host,
          host_id: options.host._id,
          resource: resource._id,
          resource_id: resource._id,
          template: monitorTemplate.id,
          id: null,
          customer_name: resource.customer_name,
          _type: 'ResourceMonitor'
        });

        debug('creating monitor from template %j', props);
        var monitor = new ResourceMonitor(props);
        monitor.save(function(err, instance){
          if(err) {
            debug(err.message);
            return doneFn(err);
          }

          ResourceService.createDefaultEvents(monitor,resource.customer_id)

          doneFn(null,{
            'monitor': instance,
            'resource': resource
          });
        });
      }
    );
  });
}

