const App = require('../../app')
const isURL = require('validator/lib/isURL')
const isMongoId = require('validator/lib/isMongoId')
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

/**
 *
 * Monitor object namespace for manipulating resources monitor
 *
 * @author Facundo
 *
 */
module.exports = {
  async create (type, input) {
    logger.log('setting up monitor data')
    logger.data('%j', input)

    try {
      if (!type in MonitorsFactory) {
        throw new Error(`monitor type ${type} is invalid`)
      }

      let data = await MonitorsFactory[type](input)
      let monitor = new MonitorModel(data)
      return monitor
    } catch (err) {
      logger.error('fail processing monitor data')
      logger.error(err)
      err.statusCode = 400
      next(err, input)
      return err
    }
  },
  async update (monitor, input, next) {
    next || (next = function(){})

    logger.debug('updating monitor properties to %j', input)

    // prepare new monitor config
    let config = await MonitorData.update(monitor, assign({}, input, input.config||{}))

    monitor.config = config
    MonitorModel.updateOne({ _id: monitor._id }, monitor.toObject())
      .then(monitor => next(null, monitor))
      .catch(err => next(err))
  },
  /**
   *
   * @param {Object} input
   * @return {Object} ErrorHandler
   *
   */
  validateData (input) {
    var errors = new ErrorHandler()
    var type = (input.type || input.monitor_type)

    delete input._type
    delete input._id
    delete input.__v
    delete input._v

    if (!input.name) { errors.required('name', input.name) }
    if (!type) { errors.required('type', type) }

    if (
      type !== MonitorConstants.RESOURCE_TYPE_NESTED &&
      ( !input.looptime || !parseInt(input.looptime) )
    ) {
      errors.required('looptime', input.looptime)
    }

    let data = assign({}, input, {
      name: input.name,
      description: input.description,
      type: type,
      monitor_type: type,
      tags: router.filter.toArray(input.tags)
    })

    logger.log('Setting up monitor type & properties')
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

        if (/%script%/.test(input.script_runas) === false) {
          input.script_runas += ' %script%' // force
        }
        data.script_runas = input.script_runas

        break

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

      case MonitorConstants.RESOURCE_TYPE_HOST:
        break;

      case MonitorConstants.RESOURCE_TYPE_PSAUX:
        break;

      default:
        errors.invalid('type', type);
        break;
    }

    return {
      data,
      errors: errors.hasErrors() ? errors : null
    }
  },
  //createMonitor (type, input, next) {
  //  next||(next=function(){});
  //  logger.log('processing monitor %s creation data', type);
  //  this.create(type, input, (error, monitor) => {
  //    if (error) {
  //      logger.log(error);
  //      return next(error, monitor);
  //    } else if (monitor==null) {
  //      var msg = 'invalid resource data';
  //      logger.error(msg);
  //      var error = new Error(msg);
  //      error.statusCode = 400;
  //      return next(error,data);
  //    } else {
  //      logger.log('creating monitor type %s', type);
  //      logger.data(monitor);

  //      monitor.resource = monitor.resource_id = input.resource._id;
  //      MonitorModel.create(
  //        monitor,
  //        function(error,monitor){
  //          if (error) {
  //            logger.error(error);
  //            return next(error);
  //          }

  //          logger.log('monitor %s created', monitor.name);
  //          return next(null, monitor);
  //        }
  //      )
  //    }
  //  })
  //},
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
        .exec(doneExec)
    } else {
      MonitorModel
        .find(query)
        .exec(doneExec)
    }
  },
  async updateMonitorWithFile (monitor, file) {
    logger.log(`[${monitor.name}] requieres update`)

    if (monitor.type === 'file') {
      if (
        !monitor.config.hasOwnProperty('is_manual_path') ||
        monitor.config.is_manual_path !== true
      ) {
        let config = Object.assign({}, monitor.config, {
          basename: file.filename,
          path: `${monitor.config.dirname}/${file.filename}`
        })
        await MonitorModel.updateOne({ _id: monitor._id }, { config })
      }
    }

    App.jobDispatcher.createAgentUpdateJob(monitor.host_id)
  }
}

/**
 *
 * given a mode string validates it.
 * returns it if valid or null if invalid
 * @param {string} mode
 * @return {string|null}
 *
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
 *
 * @author Facundo
 *
 */
const MonitorsFactory = {
  scraper: async (input) => {
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
  },
  file: async (input) => {
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
  },
  process: async (input) => {
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
  },
  script: async (input) => {
    return assign({},input,{
      name: (input.name || MonitorConstants.RESOURCE_TYPE_SCRIPT),
      type: MonitorConstants.RESOURCE_TYPE_SCRIPT,
      config: {
        script_id: input.script_id,
        script_arguments: input.script_arguments,
        script_runas: input.script_runas
      }
    })
  },
  host: async (input) => {
    return {
      tags: input.tags,
      customer_name: input.customer_name,
      host: input.host_id,
      host_id: input.host_id,
      name: (input.name || MonitorConstants.RESOURCE_TYPE_HOST),
      type: MonitorConstants.RESOURCE_TYPE_HOST,
      looptime: (input.looptime || MonitorConstants.DEFAULT_LOOPTIME),
      config: { }
    }
  },
  dstat: async (input) => {
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
  },
  psaux: async (input) => {
    return assign({},input,{
      host: input.host_id,
      name: (input.name || MonitorConstants.RESOURCE_TYPE_PSAUX),
      type: MonitorConstants.RESOURCE_TYPE_PSAUX,
      looptime: (input.looptime || MonitorConstants.DEFAULT_LOOPTIME),
      config: {}
    })
  },
  nested: async (input) => {
    let monitors = input.monitors

    for (let monitor in monitors) {
    }

    return assign({}, input, {
      name: (input.name || MonitorConstants.RESOURCE_TYPE_NESTED),
      type: MonitorConstants.RESOURCE_TYPE_NESTED,
      looptime: 0,
      config: { monitors: input.monitors }
    })
  }
}

// patch
const MonitorData = {
  async update (monitor, input) {
    this.__set(monitor, input)
    let config = assign({}, monitor.config || {})
    await this[monitor.type](config, input)
    return config
  },
  __set (monitor, input) {
    logger.debug('updating monitor properties %j', input)
    /** set common properties **/
    if ("looptime" in input) {
      monitor.looptime = input.looptime
    }
    if ("tags" in input) {
      monitor.tags = input.tags
    }
    if ("name" in input) {
      monitor.name = input.name
    }
    if ("description" in input) {
      monitor.description = input.description
    }
    if ("enable" in input) {
      monitor.enable = input.enable
    }
    if ("host_id" in input) {
      monitor.host = input.host_id
      monitor.host_id = input.host_id
    }

    // remove monitor from template
    monitor.template = null
    monitor.template_id = null
  },
  scraper (config, input) {
    config.external = Boolean(input.external_host_id)
    config.url = input.url
    config.timeout = input.timeout
    config.method = input.method
    config.json = (input.json === 'true' || input.json === true)
    config.gzip = (input.gzip === 'true' || input.gzip === true)
    config.parser = input.parser
    config.status_code = input.status_code
    config.body = input.body

    if (input.parser == 'pattern') {
      config.pattern = input.pattern
      config.script = null
    } else if (input.parser == 'script') {
      config.pattern = null
      config.script = input.script
    } else {
      config.pattern = null
      config.script = null
    }
  },
  file (config, input) {
    config.is_manual_path = input.is_manual_path
    config.path = input.path
    config.basename = input.basename
    config.dirname = input.dirname
    config.permissions = input.permissions
    config.os_username = input.os_username
    config.os_groupname = input.os_groupname
    config.file = input.file
  },
  process (config, input) {
    config.ps.raw_search = input.raw_search;
    config.ps.is_regexp = Boolean(input.is_regexp === 'true' || input.is_regexp === true)
    config.ps.pattern = (!config.ps.is_regexp) ? RegExp.escape(input.raw_search) : input.raw_search
    config.ps.psargs = input.psargs
  },
  script (config, input) {
    if (input.hasOwnProperty('script_id')) {
      config.script_id = input.script_id
    }
    if (input.hasOwnProperty('script_arguments')) {
      config.script_arguments = input.script_arguments
    }
    if (input.hasOwnProperty('script_runas')) {
      config.script_runas = input.script_runas
    }
  },
  host (config, input) {
    // no custom configuration
  },
  dstat (config, input) {
    if (input.hasOwnProperty('limit')) {
      assign(input, input.limit)
    }
    if (input.hasOwnProperty('cpu')) {
      config.limit.cpu = input.cpu
    }
    if (input.hasOwnProperty('mem')) {
      config.limit.mem = input.mem
    }
    if (input.hasOwnProperty('cache')) {
      config.limit.cache = input.cache
    }
    if (input.hasOwnProperty('disk')) {
      config.limit.disk = input.disk
    }
  },
  psaux (config, input) {
    // no custom configuration
  },
  nested (config, input) {
    let monitors = input.monitors
    if (Array.isArray(monitors)) {
      for (let index in monitors) {
        let monitor = monitors[index]
      }
    }
    config.monitors = input.monitors
  }
}

function parseUnixId (id) {
  var _id = parseInt(id)
  if (!Number.isInteger(_id) || id < 0) return null
  return _id
}
