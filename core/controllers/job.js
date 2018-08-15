const App = require('../app')
const json = require('../lib/jsonresponse')
const logger = require('../lib/logger')('controller:job')
const router = require('../router')
const Job = require('../entity/job').Job
const Host = require('../entity/host').Entity
const Constants = require('../constants/task')
const TaskConstants = require('../constants/task')
const JobConstants = require('../constants/jobs')
const StateConstants = require('../constants/states')
const TopicsConstants = require('../constants/topics')
const IntegrationConstants = require('../constants/integrations')
const audit = require('../lib/audit')
const merge = require('lodash/merge')

const dbFilter = require('../lib/db-filter');
const fetchBy = require('../lib/fetch-by')

module.exports = (server, passport) => {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  /**
   *
   * users can trigger tasks
   *
   */
  server.get(
    '/:customer/job/:job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'job',required:true})
    ),
    controller.get
  )

  server.get(
    '/:customer/job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.hostnameToHost()
    ),
    controller.fetch
  )

  server.put(
    '/:customer/job/:job',
    middlewares.concat(
      router.requireCredential('agent', { exactMatch: true }),
      router.resolve.idToEntity({ param: 'job', required: true })
    ),
    controller.finish,
    afterFinishJobHook
  )

  server.put(
    '/job/:job/redo',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({ param: 'job', required: true })
    ),
    controller.redo
  )

  server.post(
    '/:customer/job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'task',required:true}),
      router.ensureAllowed({entity:{name:'task'}})
    ),
    controller.create
    //audit.afterCreate('job',{ display: 'name' })
  )
  server.post(
    '/job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'task',required:true}),
      router.ensureAllowed({entity:{name:'task'}})
    ),
    controller.create
    //audit.afterCreate('job',{ display: 'name' })
  )

  // create job using task secret key
  server.post(
    '/job/secret/:secret', [
      router.resolve.customerNameToEntity({ required: true }),
      router.resolve.idToEntity({ param: 'task', required: true }),
      //router.ensureBelongsToCustomer({ documentName: 'task' }),
      router.requireSecret('task')
    ],
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    controller.create
  )
}

const controller = {
  get (req,res,next) {
    var job = req.job
    res.send(200, job)
  },
  /**
   * @method GET
   * @route /:customer/job
   */
  fetch (req, res, next) {
    const customer = req.customer
    const user = req.user
    const query = req.query

    logger.log('querying jobs')

    if (query.process_next) {
      if (!req.host) {
        return res.send(400, 'host is required')
      }

      App.jobDispatcher.getNextPendingJob(
        { customer, user, host: req.host },
        (err,job) => {
          if (err) { return res.send(500, err.message) }

          var jobs = []
          if (job != null) {
            jobs.push(job)
          }

          res.send(200, { jobs })
          next()
        }
      )
    } else {
      const filter = dbFilter(query, { /** default **/ })
      filter.where.customer_id = customer._id.toString()
      filter.populate = 'user'

      fetchBy.call(Job, filter, (err, jobs) => {
        if (err) { return res.send(500, err) }
        res.send(200, jobs)
        next()
      })
    }
  },
  /**
   *
   * @method PUT
   * @summary finish a job. change its lifecycle
   *
   */
  finish (req, res, next) {
    var result = req.body.result || {}
    App.jobDispatcher.finish({
      job: req.job,
      result: result,
      user: req.user,
      customer: req.customer
    }, (err, job) => {
      if (err) return res.send(500)
      res.send(200, job)
      next()
    })
  },
  /**
   *
   * @param {Object[]} req.body.task_arguments an array of objects with { order, label, value } arguments definition
   *
   */
  create (req, res, next) {
    let { task, user, customer } = req
    let args = req.body.task_arguments || []

    logger.log('creating new job')

    App.jobDispatcher.create({
      task,
      user,
      customer,
      notify: true,
      origin: (req.origin || JobConstants.ORIGIN_USER),
      task_arguments_values: args,
      script_arguments: args
    }, (err, job) => {
      if (err) {
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      res.send(200, job)
      req.job = job
      next()
    })
  },
  redo (req, res, next) {
    let job = req.job
    res.send(200)
  }
}

const afterFinishJobHook = (req, res, next) => {
  const job = req.job

  const updateHostIntegration = () => {
    switch (job._type) {
      case 'NgrokIntegrationJob':
        updateNgrokHostIntegration()
        break;
      default:
        // any other integration ?
        break;
    }
  }

  const updateNgrokHostIntegration = () => {
    const host = job.host
    var ngrok = host.integrations.ngrok
    ngrok.result = job.result
    ngrok.last_update = new Date()

    if (job.state === StateConstants.INTEGRATION_STARTED) {
      // obtain tunnel url
      if (job.result && job.result.url) {
        ngrok.active = true
        ngrok.url = job.result.url
      }
    } else if (job.state === StateConstants.INTEGRATION_STOPPED) {
      // tunnel closed. url is no longer valid
      ngrok.active = false
      ngrok.url = ''
    } else if (job.state === StateConstants.FAILURE) {
      logger.error('integration job failed to ejecute. %o', job)
    }

    let integrations = merge({}, host.integrations, { ngrok })
    Host.update(
      { _id: host._id },
      {
        $set: { integrations: integrations.toObject() }
      },
      (err) => {
        if (err) logger.error('%o', err)

        App.notifications.generateSystemNotification({
          topic: TopicsConstants.host.integrations.crud,
          data: {
            hostname: host.hostname,
            organization: req.customer.name,
            operation: Constants.UPDATE,
            model_type: host._type,
            model: {
              id: host._id,
              integrations: { ngrok: host.integrations.ngrok }
            }
          }
        })

        next()
      }
    )
  }

  // is an integration job ?
  if (job.isIntegrationJob()===true) {
    if (job.populated('host')===undefined) {
      job.populate('host', () => {
        updateHostIntegration()
      })
    } else {
      updateHostIntegration()
    }
  }
}
