const App = require('../../app')
const audit = require('../../lib/audit')
const Constants = require('../../constants/task')
const createJob = require('../../service/job/create')
const dbFilter = require('../../lib/db-filter')
const Host = require('../../entity/host').Entity
const IntegrationConstants = require('../../constants/integrations')
const JobConstants = require('../../constants/jobs')
const Job = require('../../entity/job').Job
const LifecycleConstants = require('../../constants/lifecycle')
const logger = require('../../lib/logger')('controller:job')
const router = require('../../router')
const StateConstants = require('../../constants/states')
const TaskConstants = require('../../constants/task')
const TopicsConstants = require('../../constants/topics')

module.exports = (server) => {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  /**
   * get a single job information
   */
  server.get('/:customer/job/:job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    controller.get
  )

  /**
   * fetch many jobs information
   */
  server.get('/:customer/job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.hostnameToHost(),
    (req, res, next) => {
      if (req.user.credential === 'agent') {
        controller.queue(req, res, next)
      } else {
        controller.fetch(req, res, next)
      }
    }
  )

  server.put('/:customer/job/:job',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }),
    router.resolve.idToEntity({ param: 'job', required: true }),
    controller.finish,
    afterFinishJobHook
  )

  server.post('/:customer/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'task', required:true}),
    router.ensureAllowed({entity: {name: 'task'} }),
    createJob
    //audit.afterCreate('job',{ display: 'name' })
  )

  server.post('/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'task',required:true}),
    router.ensureAllowed({entity:{name:'task'}}) ,
    createJob
    //audit.afterCreate('job',{ display: 'name' })
  )

  // create job using task secret key
  server.post('/job/secret/:secret',
    router.resolve.customerNameToEntity({ required: true }),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.requireSecret('task'),
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    createJob
    //audit.afterCreate('job',{ display: 'name' })
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
  queue (req, res, next) {
    const { customer, user, host } = req

    logger.log('agent querying queue')

    if (!host) {
      return res.send(400, 'host is required')
    }

    App.jobDispatcher.getNextPendingJob(
      { customer, user, host: req.host },
      (err, job) => {
        if (err) { return res.send(500, err.message) }

        let jobs = []
        if (job) {
          jobs.push(job.publish('agent'))
          App.scheduler.scheduleJobTimeoutVerification(job)
        }

        res.send(200, { jobs })
        next()
      }
    )
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

    const filter = dbFilter(query, { /** default **/ })
    filter.where.customer_id = customer._id.toString()

    Job.fetchBy(filter, (err, jobs) => {
      if (err) { return res.send(500, err) }
      let data = []
      jobs.forEach(job => data.push(job.publish()))
      res.send(200, data)
      next()
    })
  },
  /**
   *
   * @method PUT
   * @summary finish a job. change its lifecycle
   *
   */
  finish (req, res, next) {
    const job = req.job
    const payload = (req.body.result || {})
    const user = req.user

    logger.log(`job "${job.name}(${job._id})" finished`)
    logger.data(payload)

    App.jobDispatcher.finish({
      result: Object.assign({}, (payload.data || {}), {
        user: { email: user.email, id: user.id }
      }),
      state: payload.state,
      job,
      user,
      customer: req.customer
    }, (err, job) => {
      if (err) { return res.send(500) }
      res.send(200, job)
      next()
    })
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

    let integrations = Object.assign({}, host.integrations, { ngrok })
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
            organization_id: req.customer._id,
            operation: Constants.UPDATE,
            model_type: host._type,
            model_id: host._id,
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
