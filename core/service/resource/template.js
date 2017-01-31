'use strict';

var _ = require('lodash');
var validator = require('validator');
var logger = require('../../lib/logger')('service:resource:template');
var ResourceTemplate = require('../../entity/resource/template').Entity;
var MonitorTemplate = require('../../entity/monitor/template').Entity;
var ResourceMonitor = require('../../entity/monitor').Entity;
var Resource = require('../../entity/resource').Entity;

var MonitorService = require('./monitor');

module.exports = {
  /**
   *
   * turn a monitor and its resource into a template
   *
   * @author Facundo
   *
   */
  resourceMonitorToTemplate (monitor_id, done) {
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
  },
  /**
   *
   * Api to handle monitors.
   * validate type and data
   * @author Facundo
   * @param {Array} monitors
   *
   */
  resourceMonitorsToTemplates (
    resource_monitors, 
    customer, 
    user,
    done
  ) {
    var self = this;
    var user_id = user ? user._id : null;
    var customer_name = customer.name;
    var customer_id = customer._id;

    if(!resource_monitors) {
      var e = new Error('resource monitors definition required');
      e.statusCode = 400;
      return done(e);
    }

    if( ! Array.isArray(resource_monitors) ) {
      var e = new Error('resource monitors must be an array');
      e.statusCode = 400;
      return done(e);
    }

    if(resource_monitors.length == 0) {
      logger.log('no resource monitoros. skipping');
      return done(null,[]);
    }

    var templatized = _.after(resource_monitors.length, function(){
      logger.log('all resources & monitorese templates processed');
      done(null, templates);
    });

    logger.log('processing %s resource monitors', resource_monitors.length);

    var templates = [];

    for (var i=0; i<resource_monitors.length; i++) {
      var value = resource_monitors[i];
      logger.log('processing resource monitors %j', value);

      if (Object.keys( value ).length === 0) {
        var e = new Error('invalid resource monitor definition');
        e.statusCode = 400;
        return done(e);
      }

      if (value.hasOwnProperty('id')) {
        /* create template from existent monitor & resource */
        if (validator.isMongoId(value.id)) {
          logger.log('creating template from existent resource monitors');
          self.resourceMonitorToTemplate(
            value.id,
            function(error, tpls){
              if(error) done(error);
              logger.log('templates created');
              templates.push( tpls );
              templatized();
            }
          );
        } else {
          var e = new Error('invalid monitor id');
          e.statusCode = 400;
          return done(e);
        }
      } else {
        /* create templates from input */
        logger.log('setting up template data');

        var result = MonitorService.validateData(value);
        if (!result||result.error) {
          let msg = 'invalid resource monitor data';
          logger.error(msg);
          let e = new Error(msg);
          e.statusCode = 400;
          e.info = result.error;
          return done(e);
        }

        var data = result.data;
        data.customer_id = customer_id;
        data.customer_name = customer_name;
        data.user_id = user_id;
        logger.log('creating template from scratch');
        self.createResourceMonitorsTemplates(
          data, function(err, tpls){
            if(err) {
              logger.error(err);
              return done(err);
            }

            logger.log('templates from scratch created');
            templates.push( tpls );
            templatized();
          }
        );
      }
    }
  },
  /**
   *
   * create resource and its monitor from input.
   *
   * @author Facundo
   *
   */
  createResourceMonitorsTemplates (input, done){
    var resource_data = {
      type: input.type,
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      name: input.name,
      description: input.description,
      user_id: input.user_id
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
          if(err) return logger.error(err);

          logger.debug('templates created');
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

}

