/**
 * Monitor object namespace for manipulating resources monitor
 * @author Facundo
 */

var _ = require('lodash');
var logger = require('../../lib/logger')('eye:supervisor:service:resource:monitor');
var ResourceMonitorSchema = require('../../entity/monitor');
var ResourceMonitor = ResourceMonitorSchema.Entity;
var ResourceTemplateService = require('../../service/resource/template');
var ResourceService = require('../../service/resource');
var Job = require('../../entity/job').Entity;


exports.disableScriptMonitorsWithDeletedScript = disableScriptMonitorsWithDeletedScript;
exports.notifyScriptMonitorsUpdate = notifyScriptMonitorsUpdate;
exports.findBy = findBy;
exports.createMonitor = createMonitor;
exports.setMonitorData = setMonitorData;
exports.setType = setType;
exports.resourceMonitorsToTemplates = resourceMonitorsToTemplates;

/**
 *
 * @author Facundo
 *
 */
function setMonitorForScraper(input) {
	var host_id = input.external_host_id ? input.external_host_id : input.host_id;
	var external = input.external_host_id ? true : false;
	return {
    'customer_name': input.customer_name,
		'host_id': host_id,
		'name': input.name,
		'type': 'scraper',
		'looptime': input.looptime,
		'config': {
			'external': external,
			'pattern': input.pattern,
			'request_options': {
				'url': input.url,
				'timeout': input.timeout,
				'method': 'get'
			}
		}
	};
}

function setMonitorForProcess(input) {
	return {
    'customer_name': input.customer_name,
		'host_id': input.host_id,
		'name': input.name,
		'type': 'process',
		'looptime': input.looptime,
		'config': {
			'ps': {
				'pattern': input.pattern,
				'psargs': input.psargs
			}
		}
	};
}

function setMonitorForScript(input) {
	return {
    'customer_name': input.customer_name,
		'host_id': input.host_id,
		'name': input.name,
		'type': 'script',
		'looptime': input.looptime,
		'config': {
			'script_id': input.script_id,
			'script_arguments': input.script_arguments
		}
	};
}

function setMonitorForDstat(input){
	var looptime = input.looptime ? input.looptime : 10000 ;
	return {
    'customer_name': input.customer_name,
		'host_id': input.host_id,
		'type': 'dstat',
		'name': 'dstat',
		'looptime': looptime,
		'config': {
			'limit': {
				'cpu': 50,
				'disk': 90,
				'mem': 70,
				'cache': 70
			}
		}
	};
}

function setMonitorForPsaux(input){
	var looptime = input.looptime ? input.looptime : 15000 ;
	return {
    'customer_name': input.customer_name,
		'host_id': input.host_id,
		'name': 'psaux',
		'type': 'psaux',
		'looptime': looptime,
		'config': {}
	};
}

function setType(resourceType, monitorType) {
	return monitorType;
}

function setMonitorData(type, input, next){
	logger.log('setting up monitor data');
	try {
		switch(type) {
			case 'scraper':
        logger.log('scraper monitor');
				monitor = setMonitorForScraper(input);
				next(null, monitor);
				break;
			case 'process':
        logger.log('process monitor');
				if(!input.pattern) throw new Error('search pattern required');
				monitor = setMonitorForProcess(input);
				next(null, monitor);
				break;
			case 'script':
        logger.log('script monitor');
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
			default:
				throw new Error('monitor type is invalid');
				break;
		}
	} catch(e) {
    logger.log('error processing monitor data');
		e.statusCode = 400;
		return next(e, input);
	}
}

function createMonitor(type, input, next) {
	logger.log('processing monitor %s creation data', type);
	setMonitorData( type, input,
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
				ResourceMonitor.create(
					monitor,
					function(error,monitor){
						if(error) {
							logger.log(error);
							return next(error);
						}

						logger.log('monitor created');
						return next(null, monitor);
					});
			}
		});
}

/**
 *
 * @author Facundo
 * @param {Object} script, a script entity
 * @return null
 *
 */
function disableScriptMonitorsWithDeletedScript (script) {
  logger.log('disabling script "%s" resource-monitor', script._id);
  ResourceMonitor.find({
    'type': 'script'
  }, function(error, monitors) {
    if(error) return logger.log(error);
    if(monitors.length > 0){
      for(var i=0; i<monitors.length; i++) {
        var monitor = monitors[i];
        if(monitor.config.script_id == script._id) {
          var monitor = monitors[i];
          monitor.enable = false;
          monitor.config.script_id = null;
          monitor.config.script_arguments = [];
          monitor.save(function(error){
            if(error) return logger.log(error);
            logger.log('monitor changes saved');
            logger.log('notifying "%s"', monitor.host_id);
            Job.createAgentConfigUpdate(monitor.host_id);
          });
        }
      }
    }
  });
}

/**
 *
 * search script-monitor and create a notify job to the monitor agents.
 *
 * @author Facundo
 * @param {Object} script, a script entity
 * @return null
 *
 */
 function notifyScriptMonitorsUpdate (script) {
   logger.log('preparing agent notification "%s"', script._id);
   // if script is in Monitor? refresh agent
   ResourceMonitor.find({
     'type': 'script',
   },function(error, monitors){
     if(error) return logger.log(error);
     if(monitors.length > 0){
       var hosts = [];
       for(var i=0; i<monitors.length; i++){
         var monitor = monitors[i];
         if(monitor.config.script_id == script._id ) {
           if( hosts.indexOf(monitor.host_id) === -1 ){
             hosts.push(monitor.host_id);
             logger.log('notifying "%s"', monitor.host_id);
             Job.createAgentConfigUpdate(monitor.host_id);
           }
         }
       }
     }
   });
 }

/**
 *
 * @author Facundo
 * @param {Object} filters
 *    @property {Boolean} enable
 *    @property {ObjectId} host_id, valid mongo id string
 * @param {Function} doneFn
 *
 */
function findBy (filters, doneFn) {
  var query = {};
  filters = filters || {};
  doneFn = doneFn || function(){};

  for(var idx in filters) {
    var value = filters[idx];
    switch(idx) {
      case 'enable': query.enable = value; break;
      case 'host_id': query.host_id = value; break;
    }
  }

  ResourceMonitor.find(query, function(error,monitors){
    if(error) {
      logger.error(error);
      return doneFn(error);
    }
    return doneFn(null, monitors);
  });
}

/**
 *
 * Api to handle monitors.
 * validate type and data
 * @author Facundo
 * @param {Array} monitors
 *
 */
function resourceMonitorsToTemplates (
  resource_monitors, 
  customer, 
  user,
  done
) {
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

  var templatized = _.after( resource_monitors.length, function(){
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

    /* create template from existent monitor & resource */
    if( value.hasOwnProperty('id') ){
      if( validator.isMongoId(value.id) ){
        logger.log('creating template from existent resource monitors');
        ResourceTemplateService.resourceMonitorToTemplate(value.id, function(error, tpls){
          if(error) done(error);

          logger.log('templates created');
          templates.push( tpls );
          templatized();
        });
      } else {
        var e = new Error('invalid monitor id');
        e.statusCode = 400;
        return done(e);
      }
    }
    /* create templates from user input.  */
    else {
      logger.log('setting up template data');
      ResourceService.setResourceMonitorData(value, function(valErr, data) {
        if(valErr || !data) {
          var e = new Error('invalid resource monitor data');
          e.statusCode = 400;
          e.info = valErr;
          return done(e);
        }

        data.customer_id = customer._id;
        data.customer_name = customer.name;
        data.user_id = user._id;
        logger.log('creating template from scratch');
        ResourceTemplateService.createResourceMonitorsTemplates(data, function(err, tpls){
          if(err) {
            logger.error(err);
            return done(err);
          }

          logger.log('templates from scratch created');
          templates.push( tpls );
          templatized();
        });
      });
    }
  }
}
