"use strict";

const validator = require('validator')
const assign = require('lodash/assign')

var logger = require('../../lib/logger')('service:resource:monitor');
var ErrorHandler = require('../../lib/error-handler');
var router = require('../../router');
var MonitorEntity = require('../../entity/monitor').Entity;
var Job = require('../../entity/job').Job;

if (!RegExp.escape) {
  RegExp.escape = function (s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  };
}

function parseUnixId (id) {
  var _id = parseInt(id)
  if (!Number.isInteger(_id) || id < 0) return null
  return _id
}

/**
 * given a mode string validates it.
 * returns it if valid or null if invalid
 * @param {string} mode
 * @return {string|null}
 */
function parseUnixOctalModeString (mode) {
  if (!mode||typeof mode != 'string') return null
  if (mode.length != 4) return null
  if (['0','1','2','4'].indexOf(mode[0]) === -1) return null
  var num = parseInt(mode.substr(1,mode.length))
  if (num > 777 || num <= 0) return null
  return mode
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
  setMonitorData (type, input, next){
    var monitor;
    logger.log('setting up monitor data');
    logger.data('%j', input);
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
        case 'file':
          monitor = setMonitorForFile(input);
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
    } catch (e) {
      logger.error('failure processing monitor data')
      logger.error(e)
      e.statusCode = 400
      return next(e, input)
    }
  },
  /**
   *
   * @param {Object} input
   * @return {Object} ErrorHandler
   *
   */
  validateData (input) {
    var errors = new ErrorHandler();
    var type = (input.type||input.monitor_type);

    if (!input.name) {
      errors.required('name', input.name);
    }
    if (!type) {
      errors.required('type', type);
    }
    if (!input.looptime || !parseInt(input.looptime)) {
      errors.required('looptime', input.looptime);
    }

    var data = assign({},input,{
      name: input.name,
      description: input.description,
      type: type,
      monitor_type: type,
      tags: router.filter.toArray(input.tags)
    });

    logger.log('setting up resource type & properties');
    logger.data(data);

    switch (type) {
      case 'scraper':
        var url = input.url;
        if (!url) errors.required('url',url);
        else if (!validator.isURL(url,{require_protocol:true})) errors.invalid('url',url);
        else data.url = url;

        data.timeout = input.timeout||10000;
        //data.external_host_id = input.external_host_id;
        //if (!input.external_host_id) data.external = false;
        data.external = false;

        if (!input.parser) input.parser=null;
        else if (input.parser != 'script' && input.parser != 'pattern')
          errors.invalid('parser',input.parser);

        // identify how to parse api response selected option by user
        if (!input.status_code&&!input.pattern&&!input.script){
          errors.required('status code or parser');
        } else {
          if (input.parser) {
            if (input.parser=='pattern' && !input.pattern) {
              errors.invalid('pattern',input.pattern);
            } else if (input.parser=='script' && !input.script) {
              errors.invalid('script',input.script);
            }
          }
       }
        break;
      case 'process':
        const values = assign({},input,input.ps||{})
        data.raw_search = values.raw_search || errors.required('raw_search');
        data.psargs = values.psargs || 'aux';
        data.is_regexp = Boolean(values.is_regexp=='true'||values.is_regexp===true);
        data.pattern = !values.is_regexp ? RegExp.escape(values.raw_search) : values.raw_search;
        break;
      case 'file':
        var mode = input.permissions
        var os_user = input.os_username
        var os_group = input.os_groupname

        if (!mode) {
          data.permissions = null
        } else {
          data.permissions = parseUnixOctalModeString(mode)||errors.invalid('mode')
        }

        if (!os_user) {
          data.os_username = null
        } else {
          data.os_username = os_user
        }

        if (!os_group) {
          data.os_groupname = null
        } else {
          data.os_groupname = os_group
        }

        data.is_manual_path = Boolean(input.is_manual_path)
        data.path = (input.path||errors.required('path'))
        data.dirname = (input.dirname||errors.required('dirname'))
        data.basename = input.basename
        data.file = (input.file||errors.required('file'))
        break;
      case 'script':
        var scriptArgs = router.filter.toArray(input.script_arguments);
        data.script_arguments = scriptArgs;
        data.script_id = input.script_id||errors.required('script_id',input.script_id);
        if (input.script_runas) {
          if (/%script%/.test(input.script_runas)===false) {
            data.script_runas = errors.invalid('script_runas',input.script_runas);
          } else {
            data.script_runas = input.script_runas;
          }
        } else {
          data.script_runas = '';
        }
        break;
      case 'dstat':
        data.cpu = input.cpu||60;
        data.mem = input.mem||60;
        data.cache = input.cache||60;
        data.disk = input.disk||60;
        break;
      case 'psaux': break;
      case 'host': break;
      default:
        errors.invalid('type', type);
        break;
    }

    return {
      data: data,
      errors: errors.hasErrors() ? errors : null
    };
  },
  createMonitor (type, input, next) {
    next||(next=function(){});
    logger.log('processing monitor %s creation data', type);
    this.setMonitorData(type, input, (error,monitor) => {
      if (error) {
        logger.log(error);
        return next(error, monitor);
      } else if(monitor==null) {
        var msg = 'invalid resource data';
        logger.error(msg);
        var error = new Error(msg);
        error.statusCode = 400;
        return next(error,data);
      } else {
        logger.log('creating monitor type %s', type);
        logger.data(monitor);

        monitor.resource = monitor.resource_id = input.resource._id;
        MonitorEntity.create(
          monitor,
          function(error,monitor){
            if (error) {
              logger.error(error);
              return next(error);
            }

            logger.log('monitor %s created', monitor.name);
            return next(null, monitor);
          }
        )
      }
    })
  },
  /**
   *
   * @author Facundo
   * @param {object} filters
   * @property {boolean} filters.enable
   * @property {string} filters.host_id - valid mongo id string
   * @param {Function} doneFn
   *
   */
  findBy (filters, options, doneFn) {
    var query = {};
    filters = filters || {};

    if (typeof options == 'function') {
      doneFn = options;
      options = {};
    } else {
      options = options || {};
      doneFn = doneFn || function(){};
    }

    for (var prop in filters) {
      var value = filters[prop];
      switch (prop) {
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
      if (err) {
        logger.error(err);
        return doneFn(err);
      }
      return doneFn(null, monitors);
    }

    logger.log('running query %j', query);
    if (options.populate) {
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
}

/**
 *
 * @author Facundo
 *
 */
function setMonitorForScraper (input) {
	return assign({},input,{
		name: input.name || 'scraper',
		type: 'scraper',
    config: {
      external: false,
      url: input.url,
      timeout: input.timeout,
      method: input.method,
      body: input.body,
      gzip: input.gzip,
      json: input.json,
      status_code: input.status_code,
      parser: input.parser,
      pattern: (input.parser == 'pattern') ? input.pattern : null,
      script: (input.parser == 'script') ? input.script : null
    }
	})
}

function setMonitorForFile(input) {
	return assign({},input,{
    name: input.name || 'file',
		type: 'file',
    config: {
      file: input.file,
      file_id: input.file._id,
      is_manual_path: input.is_manual_path,
      path: input.path,
      basename: input.basename,
      dirname: input.dirname,
      os_username: input.os_username,
      os_groupname: input.os_groupname,
      permissions: input.permissions
    }
	})
}

function setMonitorForProcess(input) {
  var is_regexp = Boolean(input.is_regexp=='true'||input.is_regexp===true);
  return assign({},input,{
    name: input.name || 'process',
    type: 'process',
    config: {
      ps: {
        is_regexp: is_regexp,
        pattern: ( !is_regexp ? RegExp.escape(input.raw_search) : input.raw_search ),
        raw_search: input.raw_search,
        psargs: input.psargs,
      }
    }
  })
}

function setMonitorForScript(input) {
	return assign({},input,{
		name: (input.name || 'script'),
		type: 'script',
		config: {
			script_id: input.script_id,
			script_arguments: input.script_arguments,
			script_runas: input.script_runas
		}
	})
}

function setMonitorForHost(input){
	return {
    tags: input.tags,
    customer_name: input.customer_name,
		host: input.host_id,
		host_id: input.host_id,
		type:'host',
		name: (input.name || 'host'),
		looptime: (input.looptime || 10000),
		config: { }
	};
}

function setMonitorForDstat(input){
	return assign({},input,{
		host: input.host_id,
		type: 'dstat',
		name: (input.name || 'dstat'),
		looptime: (input.looptime || 10000),
		config: {
			limit: {
				cpu: input.cpu || 50,
				disk: input.disk || 90,
				mem: input.mem || 70,
				cache: input.cache || 70
			}
		}
	})
}

function setMonitorForPsaux(input){
	return assign({},input,{
		host: input.host_id,
		name: (input.name || 'psaux'),
		type: 'psaux',
		looptime: (input.looptime || 15000),
		config: {}
	})
}
