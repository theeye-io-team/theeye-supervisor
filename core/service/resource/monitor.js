"use strict";

var _ = require('lodash');
var logger = require('../../lib/logger')('service:resource:monitor');
var MonitorEntity = require('../../entity/monitor').Entity;
var ErrorHandler = require('../../lib/errorHandler');
var filter = require('../../router/param-filter');
var validator = require('validator');

var ResourceTemplateService = require('./template');
var ResourceService = require('./index');
var Job = require('../../entity/job').Job;

if(!RegExp.escape){
  RegExp.escape = function(s){
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  };
}

/**
 * Monitor object namespace for manipulating resources monitor
 * @author Facundo
 */

module.exports = {

  /**
  *
  *
  *
  *
  *
  *
  *    WARNING WARNING
  *
  *   NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
  *
  *
  * THIS IS JUST FOR THE CREATION PART
  * UPDATE IS IN THIS FILE
  *
  * entity/monitor/schema.js
  *
  *
  * UGLY I KNOW....
  *
  *
  *
  *
  *
  *
  */
  setMonitorData: function (type, input, next){
    var monitor;
    logger.log('setting up monitor data %j',input);
    try {
      switch(type) {
        case 'scraper':
          monitor = setMonitorForScraper(input);
          next(null, monitor);
          break;
        case 'process':
          monitor = setMonitorForProcess(input);
          next(null, monitor);
          break;
        case 'script':
          monitor = setMonitorForScript(input);
          next(null, monitor);
          break;
        case 'dstat':
          monitor = setMonitorForDstat(input);
          next(null, monitor);
          break;
        case 'psaux':
          monitor = setMonitorForPsaux(input);
          next(null, monitor);
          break;
        case 'host':
          monitor = setMonitorForHost(input);
          next(null, monitor);
          break;
        default:
          throw new Error(`monitor type ${type} is invalid`);
          break;
      }
    } catch(e) {
      logger.log('error processing monitor data');
      e.statusCode = 400;
      return next(e, input);
    }
  },

  /**
  *
  * @return {object ErrorHandler}
  *
  */
  validateData: function (input) {
    var errors = new ErrorHandler();
    var type = (input.type||input.monitor_type);

    input.description||(input.description=input.name);
    input.name||(input.name=input.description);

    if( !type ) errors.required('type',type);
    if( !input.looptime || !parseInt(input.looptime) ) errors.required('looptime',input.looptime);
    if( !input.description ) errors.required('description',input.description);
    input.name||(input.name=input.description);

    var data = _.assign({},input,{
      'name': input.name,
      'description': input.description,
      'type': type,
      'monitor_type': type,
      'tags': filter.toArray(input.tags)
    });

    logger.log('setting up resource type & properties');
    logger.log(data);

    switch(type)
    {
      case 'scraper':
        var url = input.url;
        if( ! url ) errors.required('url',url);
        else if( !validator.isURL(url,{require_protocol:true}) ) errors.invalid('url',url);
        else data.url = url;

        data.timeout = input.timeout||10000;
        data.external_host_id = input.external_host_id;
        if( !input.external_host_id ) data.external = false;

        if(!input.parser) input.parser=null;
      else if(input.parser != 'script' && input.parser != 'pattern')
        errors.invalid('parser',input.parser);

      // identify how to parse api response selected option by user
      if(!input.status_code&&!input.pattern&&!input.script){
        errors.required('status code or parser');
      } else {
        if(input.parser){
          if(input.parser=='pattern' && !input.pattern){
            errors.invalid('pattern',input.pattern);
          } else if(input.parser=='script' && !input.script){
            errors.invalid('script',input.script);
          }
        }
      }
      break;
    case 'process':
      data.raw_search = input.raw_search || errors.required('raw_search');
      data.psargs = input.psargs || 'aux';
      data.is_regexp = Boolean(input.is_regexp=='true'||input.is_regexp===true);
      data.pattern = ( ! data.is_regexp ? RegExp.escape(data.raw_search) : data.raw_search );
      break;
    case 'script':
      var scriptArgs = filter.toArray(input.script_arguments);
      data.script_arguments = scriptArgs;
      data.script_id = input.script_id || errors.required('script_id',input.script_id);
      data.script_runas = input.script_runas || '';
      break;
    case 'dstat':
      data.cpu = input.cpu || 60;
      data.mem = input.mem || 60;
      data.cache = input.cache || 60;
      data.disk = input.disk || 60;
      break;
    case 'psaux': break;
    default:
      errors.invalid('type', type);
      break;
    }

    return {
      data: data,
      errors: errors.hasErrors() ? errors : null
    };
  },



  createMonitor: function (type, input, next) {
    next||(next=function(){});
    logger.log('processing monitor %s creation data', type);
    this.setMonitorData(type, input,
      function(error,monitor){
        if(error) {
          logger.log(error);
          return next(error, monitor);
        } else if(monitor==null) {
          var msg = 'invalid resource data';
          logger.log(msg);
          var error = new Error(msg);
          error.statusCode = 400;
          return next(error,data);
        } else {
          logger.log('creating monitor type %s', type);
          logger.log(monitor);

          monitor.resource = monitor.resource_id = input.resource._id;
          MonitorEntity.create(
            monitor,
            function(error,monitor){
              if(error) {
                logger.log(error);
                return next(error);
              }

              logger.log('monitor %s created', monitor.name);
              return next(null, monitor);
            });
        }
      });
  },


  /**
  *
  * @author Facundo
  * @param {Object} filters
  *    @property {Boolean} enable
  *    @property {ObjectId} host_id, valid mongo id string
  * @param {Function} doneFn
  *
  */
  findBy  : function (filters, options, doneFn) {
    var query = {};
    filters = filters || {};

    if(typeof options == 'function'){
      doneFn = options;
      options = {};
    } else {
      options = options || {};
      doneFn = doneFn || function(){};
    }

    for(var prop in filters) {
      var value = filters[prop];
      switch(prop){
        case 'enable':
        case 'host_id':
        case 'type': 
          query[prop] = value; 
          break;
        case 'script':
          query['config.script_id'] = value.toString(); // why to string is required to get it work ??? WTF ???
          break;
      }
    }

    function doneExec (err, monitors) {
      logger.log('done searching');
      if(err) {
        logger.error(err);
        return doneFn(err);
      }
      return doneFn(null, monitors);
    }

    logger.log('running query %j', query);
    if( options.populate ){
      logger.log('populating monitors');
      MonitorEntity
      .find(query)
      .populate('resource')
      .exec(doneExec);
    } else {
      MonitorEntity
      .find(query)
      .exec(doneExec);
    }
  },


  /**
  *
  * Api to handle monitors.
  * validate type and data
  * @author Facundo
  * @param {Array} monitors
  *
  */
  resourceMonitorsToTemplates : function (
    resource_monitors, 
    customer, 
    user,
    done
  ) {
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

    for(var i=0; i<resource_monitors.length; i++){
      var value = resource_monitors[i];
      logger.log('processing resource monitors %j', value);

      if( Object.keys( value ).length === 0 ) {
        var e = new Error('invalid resource monitor definition');
        e.statusCode = 400;
        return done(e);
      }

      if( value.hasOwnProperty('id') ){
        /* create template from existent monitor & resource */
        if( validator.isMongoId(value.id) ){
          logger.log('creating template from existent resource monitors');
          ResourceTemplateService
          .resourceMonitorToTemplate(
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

        var result = this.validateData(value);
        if(!result || result.error) {
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
        ResourceTemplateService
        .createResourceMonitorsTemplates(
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
  }


}

/**
 *
 * @author Facundo
 *
 */
function setMonitorForScraper(input) {
	var host_id = input.external_host_id ? input.external_host_id : input.host_id;
	var external = Boolean(input.external_host_id);
	return {
    'tags': input.tags,
    'customer_name': input.customer_name,
		'host': host_id,
		'host_id': host_id,
		'name': input.name || 'scraper',
		'type': 'scraper',
		'looptime': input.looptime,
    'config': {
      'external': external,
      'url': input.url,
      'timeout': input.timeout,
      'method': input.method,
      'body': input.body,
      'gzip': input.gzip,
      'json': input.json,
      'status_code': input.status_code,
      'parser': input.parser,
      'pattern': input.parser == 'pattern' ? input.pattern : null,
      'script': input.parser == 'script' ? input.script : null
    }
	};
}

function setMonitorForProcess(input) {
  var is_regexp = Boolean(input.is_regexp=='true'||input.is_regexp===true);
	return {
    'tags': input.tags,
    'customer_name': input.customer_name,
		'host_id': input.host_id,
		'host': input.host_id,
		'name': input.name || 'process',
		'type': 'process',
		'looptime': input.looptime,
		'config': {
			'ps': {
        'is_regexp': is_regexp,
				'pattern': ( ! is_regexp ? RegExp.escape(input.raw_search) : input.raw_search ),
				'raw_search': input.raw_search,
				'psargs': input.psargs,
			}
		}
	};
}

function setMonitorForScript(input) {
	return {
    'tags': input.tags,
    'customer_name': input.customer_name,
		'host': input.host_id,
		'host_id': input.host_id,
		'name': input.name || 'script',
		'type': 'script',
		'looptime': input.looptime,
		'config': {
			'script_id': input.script_id,
			'script_arguments': input.script_arguments,
			'script_runas': input.script_runas
		}
	};
}

function setMonitorForHost(input){
	var looptime = input.looptime || 10000 ;
	return {
    'tags': input.tags,
    'customer_name':input.customer_name,
		'host': input.host_id,
		'host_id':input.host_id,
		'type':'host',
		'name': input.name || 'host',
		'looptime':looptime,
		'config':{ }
	};
}

function setMonitorForDstat(input){
	var looptime = input.looptime ? input.looptime : 10000 ;
	return {
    'tags': input.tags,
    'customer_name': input.customer_name,
		'host': input.host_id,
		'host_id': input.host_id,
		'type': 'dstat',
		'name': input.name || 'dstat',
		'looptime': looptime,
		'config': {
			'limit': {
				'cpu': input.cpu || 50,
				'disk': input.disk || 90,
				'mem': input.mem || 70,
				'cache': input.cache || 70
			}
		}
	};
}

function setMonitorForPsaux(input){
	var looptime = input.looptime ? input.looptime : 15000 ;
	return {
    'tags': input.tags,
    'customer_name': input.customer_name,
		'host': input.host_id,
		'host_id': input.host_id,
		'name': input.name || 'psaux',
		'type': 'psaux',
		'looptime': looptime,
		'config': {}
	};
}
