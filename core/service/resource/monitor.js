"use strict"

const isURL = require('validator/lib/isURL')
const isMongoId = require('validator/lib/isMongoId')
//const assign = require('lodash/assign')
const assign = Object.assign

const logger = require('../../lib/logger')('service:resource:monitor')
const ErrorHandler = require('../../lib/error-handler')
const router = require('../../router')
const MonitorModel = require('../../entity/monitor').Entity
const Job = require('../../entity/job').Job
const MonitorConstants = require('../../constants/monitors')

if (!RegExp.escape) {
  RegExp.escape = function (s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')
  }
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
  setMonitorData (type, input, next) {
    var monitor;
    logger.log('setting up monitor data');
    logger.data('%j', input);
    try {
      switch (type) {
        case MonitorConstants.RESOURCE_TYPE_SCRAPER:
          monitor = setMonitorForScraper(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_PROCESS:
          monitor = setMonitorForProcess(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_SCRIPT:
          monitor = setMonitorForScript(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_FILE:
          monitor = setMonitorForFile(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_DSTAT:
          monitor = setMonitorForDstat(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_PSAUX:
          monitor = setMonitorForPsaux(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_HOST:
          monitor = setMonitorForHost(input);
          next(null, monitor);
          break;
        case MonitorConstants.RESOURCE_TYPE_NESTED:
          monitor = setMonitorForNestedMonitors(input);
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
  update (monitor, input, next) {
    next || (next = function(){})

    const type = monitor.type
    logger.debug('updating monitor properties to %j', input)

    /** set common properties **/
    if (input.looptime) { monitor.looptime = input.looptime }
    if (input.tags) { monitor.tags = input.tags }
    if (input.name) { monitor.name = input.name }
    if (typeof input.description === 'string') {
      monitor.description = input.description
    }
    if (typeof input.enable == 'boolean') {
      monitor.enable = input.enable
    }
    if (input.host_id) {
      monitor.host = input.host_id
      monitor.host_id = input.host_id
    }

    // remove monitor from template
    monitor.template = null
    monitor.template_id = null

    // prepare monitor.config
    let config = monitor.config || {}
    if (input.config) { assign(input, input.config) }

    switch (type) {
      case 'scraper':
        //monitor.host_id = input.external_host_id || input.host_id;
        monitor.host_id = input.host_id;
        config.external = Boolean(input.external_host_id);
        config.url = input.url;
        config.timeout = input.timeout;
        config.method = input.method;
        config.json = (input.json=='true'||input.json===true);
        config.gzip = (input.gzip=='true'||input.gzip===true);
        config.parser = input.parser;
        config.status_code = input.status_code;
        config.body = input.body;

        if(input.parser=='pattern'){
          config.pattern = input.pattern;
          config.script = null;
        } else if(input.parser=='script'){
          config.pattern = null;
          config.script = input.script;
        } else {
          config.pattern = null;
          config.script = null;
        }
        break;
      case 'process':
        config.ps.raw_search = input.raw_search;
        config.ps.is_regexp = Boolean(input.is_regexp=='true' || input.is_regexp===true);
        config.ps.pattern = (!config.ps.is_regexp) ? RegExp.escape(input.raw_search) : input.raw_search;
        config.ps.psargs = input.psargs;
        break;
      case 'file':
        config.is_manual_path = input.is_manual_path
        config.path = input.path
        config.basename = input.basename
        config.dirname = input.dirname
        config.permissions = input.permissions
        config.os_username = input.os_username
        config.os_groupname = input.os_groupname
        config.file = input.file
        break;
      case 'script':
        if (input.script_id) config.script_id = input.script_id;
        if (input.script_arguments) config.script_arguments = input.script_arguments;
        if (input.script_runas) config.script_runas = input.script_runas;
        break;
      case 'dstat':
        if (input.limit) { assign(input, input.limit) }
        if (input.cpu) { config.limit.cpu = input.cpu }
        if (input.mem) { config.limit.mem = input.mem }
        if (input.cache) { config.limit.cache = input.cache }
        if (input.disk) { config.limit.disk = input.disk }
        break;
      case 'nested':
        config.monitors = input.monitors
      case 'host':
      case 'psaux':
        // no custom configuration
        break;
      default:
        var error = new Error('monitor type "' + type + '" unsupported')
        logger.err(error.message);
        return next(error);
        break;
    }

    monitor.config = config
    monitor.updateOne(monitor.toObject(), {}, next)
  },
  /**
   *
   * @param {Object} input
   * @return {Object} ErrorHandler
   *
   */
  validateData (input) {
    var errors = new ErrorHandler()
    var type = (input.type||input.monitor_type)

    if (!input.name) errors.required('name', input.name)
    if (!type) errors.required('type', type)
    if (type!=='nested' && (!input.looptime || !parseInt(input.looptime))) {
      errors.required('looptime', input.looptime)
    }

    let data = assign({},input,{
      name: input.name,
      description: input.description,
      type: type,
      monitor_type: type,
      tags: router.filter.toArray(input.tags)
    })

    logger.log('setting up resource type & properties')
    logger.data(data)

    switch (type) {
      case MonitorConstants.RESOURCE_TYPE_SCRAPER:
        var url = input.url
        if (!url) errors.required('url',url)
        else if (!isURL(url,{require_protocol:true})) errors.invalid('url',url)
        else data.url = url

        data.timeout = input.timeout||10000
        data.external = false

        if (!input.parser) input.parser=null
        else if (input.parser != 'script' && input.parser != 'pattern') {
          errors.invalid('parser',input.parser)
        }

        // identify how to parse api response selected option by user
        if (!input.status_code&&!input.pattern&&!input.script){
          errors.required('status code or parser')
        } else {
          if (input.parser) {
            if (input.parser=='pattern' && !input.pattern) {
              errors.invalid('pattern',input.pattern)
            } else if (input.parser=='script' && !input.script) {
              errors.invalid('script',input.script)
            }
          }
        }
        break;

      case MonitorConstants.RESOURCE_TYPE_PROCESS:
        const values = assign({},input,input.ps||{})
        data.raw_search = values.raw_search || errors.required('raw_search')
        data.psargs = values.psargs || 'aux'
        data.is_regexp = Boolean(values.is_regexp=='true'||values.is_regexp===true)
        data.pattern = !values.is_regexp ? RegExp.escape(values.raw_search) : values.raw_search
        break;

      case MonitorConstants.RESOURCE_TYPE_FILE:
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

      case MonitorConstants.RESOURCE_TYPE_SCRIPT:
        var scriptArgs = router.filter.toArray(input.script_arguments)
        data.script_arguments = scriptArgs
        data.script_id = input.script_id||errors.required('script_id',input.script_id)
        if (input.script_runas) {
          if (/%script%/.test(input.script_runas)===false) {
            data.script_runas = errors.invalid('script_runas',input.script_runas)
          } else {
            data.script_runas = input.script_runas
          }
        } else {
          data.script_runas = ''
        }
        break;

      case MonitorConstants.RESOURCE_TYPE_DSTAT:
        data.cpu = input.cpu || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_CPU
        data.disk = input.disk || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_DISK
        data.mem = input.mem || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_MEM
        data.cache = input.cache || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_CACHE
        break;

      case MonitorConstants.RESOURCE_TYPE_NESTED:
        let filteredMonitors = []
        if (!Array.isArray(input.monitors)) {
          errors.required('monitors', input.monitors)
        } else if (input.monitors.length === 0) {
          errors.required('monitors', input.monitors)
        } else {
          input.monitors.forEach(monitor => {
            let _id =
              isMongoId(monitor) ? monitor :
              (typeof monitor === 'object' && isMongoId(monitor.id)) ? monitor.id : null

            if (!_id) {
              errors.invalid('monitors', input.monitors)
            } else {
              filteredMonitors.push({ _id, id: _id })
            }
          })
        }
        data.monitors = filteredMonitors
        break;

      case MonitorConstants.RESOURCE_TYPE_PSAUX: break;
      case MonitorConstants.RESOURCE_TYPE_HOST: break;
      default:
        errors.invalid('type', type);
        break;
    }

    return {
      data: data,
      errors: errors.hasErrors() ? errors : null
    }
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
        MonitorModel.create(
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
   * DO NOT USE - DEPRECATED !
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
        case 'file':
          query['config.file'] = value.toString();
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
      MonitorModel
        .find(query)
        .populate('resource')
        .exec(doneExec);
    } else {
      MonitorModel
        .find(query)
        .exec(doneExec);
    }
  }
}

/**
 *
 * @author Facundo
 *
 */
function setMonitorForScraper (input) {
	return assign({},input,{
		name: (input.name || MonitorConstants.RESOURCE_TYPE_SCRAPER),
		type: MonitorConstants.RESOURCE_TYPE_SCRAPER,
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

function setMonitorForFile (input) {
	return assign({},input,{
		name: (input.name || MonitorConstants.RESOURCE_TYPE_FILE),
		type: MonitorConstants.RESOURCE_TYPE_FILE,
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

const setMonitorForProcess = (input) => {
  var is_regexp = Boolean(input.is_regexp=='true'||input.is_regexp===true);
  return assign({},input,{
		name: (input.name || MonitorConstants.RESOURCE_TYPE_PROCESS),
		type: MonitorConstants.RESOURCE_TYPE_PROCESS,
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

const setMonitorForScript = (input) => {
	return assign({},input,{
		name: (input.name || MonitorConstants.RESOURCE_TYPE_SCRIPT),
		type: MonitorConstants.RESOURCE_TYPE_SCRIPT,
		config: {
			script_id: input.script_id,
			script_arguments: input.script_arguments,
			script_runas: input.script_runas
		}
	})
}

const setMonitorForHost = (input) => {
	return {
    tags: input.tags,
    customer_name: input.customer_name,
		host: input.host_id,
		host_id: input.host_id,
		name: (input.name || MonitorConstants.RESOURCE_TYPE_HOST),
		type: MonitorConstants.RESOURCE_TYPE_HOST,
		looptime: (input.looptime || MonitorConstants.DEFAULT_LOOPTIME),
		config: { }
	};
}

const setMonitorForDstat = (input) => {
	return assign({},input,{
		host: input.host_id,
		name: (input.name || MonitorConstants.RESOURCE_TYPE_DSTAT),
		type: MonitorConstants.RESOURCE_TYPE_DSTAT,
		looptime: (input.looptime || MonitorConstants.DEFAULT_LOOPTIME),
		config: {
			limit: {
				cpu: input.cpu || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_CPU,
				disk: input.disk || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_DISK,
				mem: input.mem || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_MEM,
				cache: input.cache || MonitorConstants.DEFAULT_HEALTH_THRESHOLD_CACHE
			}
		}
	})
}

const setMonitorForPsaux = (input) => {
	return assign({},input,{
		host: input.host_id,
		name: (input.name || MonitorConstants.RESOURCE_TYPE_PSAUX),
		type: MonitorConstants.RESOURCE_TYPE_PSAUX,
		looptime: (input.looptime || MonitorConstants.DEFAULT_LOOPTIME),
		config: {}
	})
}

const setMonitorForNestedMonitors = (input) => {
	return assign({}, input, {
		name: (input.name || MonitorConstants.RESOURCE_TYPE_NESTED),
		type: MonitorConstants.RESOURCE_TYPE_NESTED,
		looptime: 0,
		config: { monitors: input.monitors }
	})
}
