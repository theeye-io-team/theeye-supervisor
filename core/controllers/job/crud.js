const isEmail = require('validator/lib/isEmail')
const logger = require('../../lib/logger')('controller:job')
const App = require('../../app')
const ACL = require('../../lib/acl')
const audit = require('../../lib/audit')
const Constants = require('../../constants/task')
const createJob = require('../../service/job/create')
const dbFilter = require('../../lib/db-filter')
const Host = require('../../entity/host').Entity
const IntegrationConstants = require('../../constants/integrations')
const JobConstants = require('../../constants/jobs')
const LifecycleConstants = require('../../constants/lifecycle')
const router = require('../../router')
const StateConstants = require('../../constants/states')
const TaskConstants = require('../../constants/task')
const TopicsConstants = require('../../constants/topics')
const { ClientError, ServerError } = require('../../lib/error-handler')

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
    router.ensureAllowed({ entity: { name: 'job' } }),
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
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' } }),
    createJob
    //audit.afterCreate('job',{ display: 'name' })
  )

  server.post('/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({ param: 'task', required: true }),
    router.ensureAllowed({ entity: { name: 'task' }}) ,
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

  server.put('/job/:job/acl',
    middlewares,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.replaceAcl
  )

  server.put('/job/:job/assignee',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    router.requireCredential('admin'),
    router.resolve.idToEntityByCustomer({ param: 'job', required: true }),
    controller.updateAssignee
  )
}

const controller = {
  get (req,res,next) {
    res.send(200, req.job)
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

    const filters = dbFilter(query, { /** default **/ })
    filters.where.customer_id = customer._id.toString()

    if (!ACL.hasAccessLevel(req.user.credential, 'admin')) {
      // find what this user can access
      filters.where.acl = req.user.email
    }

    App.Models.Job.Job.fetchBy(filters, (err, jobs) => {
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
    const { user, job } = req
    const payload = req.body.result || {}

    // prevent canceled job to be updated
    if (job.lifecycle !== LifecycleConstants.ASSIGNED) {
      return res.send(200)
    }

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
      if (err) {
        return res.send(500)
      }
      res.send(200, job)
      next()
    })
  },
  async replaceAcl (req, res, next) {
    try {
      const job = req.job
      const search = req.body

      if (!Array.isArray(search) || search.length === 0) {
        throw new ClientError('Invalid acl format')
      }

      for (let value of search) {
        if (typeof value !== 'string') {
          throw new ClientError(`Invalid acl format. Value ${value} must be string`)
        }
      }

      const users = await App.gateway.user.fetch(search, { customer_id: req.customer.id })
      if (!users || users.length === 0) {
        throw new ClientError('Invalid members')
      }

      const acl = users.map(user => user.email)

      if (job._type === JobConstants.WORKFLOW_TYPE) {
        App.jobDispatcher.updateWorkflowJobsAcls(job, acl)
      }

      job.acl = acl
      await job.save()
      res.send(200, job.acl)
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
  },
  async updateAssignee (req, res, next) {
    try {
      const job = req.job
      const search = req.body

      if (!Array.isArray(search) || search.length === 0) {
        throw new ClientError('invalid format')
      }

      for (let value of search) {
        if (typeof value !== 'string') {
          throw new ClientError(`invalid body payload format. wrong value ${value}`)
        }
      }

      const members = await App.gateway.member.fetch(search, { customer_id: req.customer.id })
      if (!members || members.length === 0) {
        throw new ClientError('invalid members')
      }

      job.user_inputs_members = members.map(member => member.id)
      await job.save()
      res.send(200, job.user_inputs_members)
    } catch (err) {
      logger.error(err, err.status)
      res.send(err.status || 500, err.message)
    }
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
