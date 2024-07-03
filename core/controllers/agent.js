
const mongoose = require('mongoose')
const App = require('../app')
const systemConfig = require('config').system
const MonitorsConstants = require('../constants/monitors')
const { ClientError, ServerError } = require('../lib/error-handler')

const logger = require('../lib/logger')('controller:agent')
const router = require('../router')
//var ResourceManager = require('../service/resource')
//var ResourceMonitorService = require('../service/resource/monitor')

const File = require('../entity/file').File;
//const User = require('../entity/user').Entity

module.exports = function (server) {
  server.put('/:customer/agent/:hostname',
    server.auth.bearerMiddleware,
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.hostnameToHost({ required: true }),
    controller.update
  )

  server.get('/:customer/agent/:hostname/config',
    server.auth.bearerMiddleware,
    router.requireCredential('agent'),
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    router.resolve.hostnameToHost({ required: true }),
    controller.config
  )
}

const controller = {
  /**
   *
   * @path /:customer/agent/:hostname/config
   *
   */
  async update (req, res) {
    try {
      const { customer, host } = req
      if (!host) {
        throw new ClientError('Not Found', { statusCode: 404 })
      }

      if (customer.disabled === true || host.disabled === true) {
        res.send(204)
      } else {
        const resource = await findHostResource(host)
        const manager = new App.resource(resource)
        manager
          .handleState({ state: MonitorsConstants.RESOURCE_NORMAL })
          .catch(err => {
            logger.error(err)
          })

        res.send(204)
      }
    } catch (err) {
      res.sendError(err)
    }
  },
  /**
   *
   * @author Facundo
   * @method get
   * @path /:customer/agent/:hostname/config
   *
   */
  async config (req, res) {
    try {
      const { user, customer } = req

      const host = req.host
      if (!host) {
        throw new ClientError('Not Found', { statusCode: 404 })
      }

      if (customer.disabled === true || host.disabled === true) {
        const workers = generateBlockedAgentConfig()
        res.send(200, { workers })
      } else {
        const monitors = await App.Models.Monitor.Monitor.find({
          enable: true,
          host_id: host._id,
          customer_id: customer._id
        })

        const workers = await generateAgentConfig(monitors)
        if (!workers) {
          throw new ServerError('configuration cannot be obtained')
        }

        res.send(200, { workers })
      }
    } catch (err) {
      logger.error(err)
      res.sendError(err)
    }
  }
}

const findHostResource = (host) => {
  return new Promise((resolve, reject) => {
    const query = { type: 'host', ensureOne: true }
    App.resource.findHostResources(host, query, (err, resource) => {
      if (err) {
        logger.error(err)
        reject (err)
      } else if (!resource) {
        logger.error(`Host ${host._id} resource not found`)
        reject( new ServerError() )
      } else {
        resolve(resource)
      }
    })
  })
}

const generateBlockedAgentConfig = () => {

  return []

}

const generateAgentConfig = async (monitors) => {
  const promises = []

  for (let monitor of monitors) {
    const configProm = ConfigFactory.create(monitor).catch(e => e)
    promises.push( configProm )
  }

  const workers = await Promise.all(promises)

  return workers.filter(worker => worker !== null)
}

const ConfigFactory = {
  /**
   * @return Promise
   */
  create (monitor) {
    const config = {
      type: monitor.type,
      name: monitor.name,
      looptime: monitor.looptime,
      resource_id: monitor.resource_id
    }

    if (!this.hasOwnProperty(monitor.type)) {
      return null
    }

    return this[monitor.type](config, monitor)
  },
  async file (config, monitor) {
    const file = await File.findById(monitor.config.file)
    if (file === null) {
      throw new ServerError('File is invalid or not present in worker\'s configuration.')
    }

    return (
      Object.assign(
        config,
        monitor.config,
        { file: file.toObject() }
      )
    )
  },
  async scraper (config, monitor) {
    return Object.assign(config, monitor.config)
  },
  async process (config, monitor) {
    config.ps = monitor.config.ps
    return config
  },
  async script (config, monitor) {
    const script = await File.findById(monitor.config.script_id)
    if (script === null) {
      throw new ServerError('File is invalid or not present in worker\'s configuration.')
    }

    config.script = script.toObject()
    config.script.arguments = (monitor.config.script_arguments||[])
    config.script.runas = (monitor.config.script_runas||'')

    return config
  },
  async dstat (config, monitor) {
    config.limit = monitor.config.limit
    return config
  },
  async listener (config, monitor) {
    config.type = 'listener'
    Object.assign(config, monitor.config)
    return config
  },
  async psaux (config, monitor) {
    return config
  },
  async host (config, monitor) {
    return null
  },
  async nested (config, monitor) {
    return null
  }
}
