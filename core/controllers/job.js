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
const LifecycleConstants = require('../constants/lifecycle')
const audit = require('../lib/audit')
const merge = require('lodash/merge')

const dbFilter = require('../lib/db-filter');
//const fetchBy = require('../lib/fetch-by')

module.exports = (server, passport) => {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  /** users can trigger tasks **/
  server.get(
    '/:customer/job/:job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    controller.get
  )

  server.get(
    '/:customer/job',
    middlewares,
    router.requireCredential('viewer'),
    router.resolve.hostnameToHost(),
    controller.fetch
  )

  server.put(
    '/:customer/job/:job',
    middlewares,
    router.requireCredential('agent', { exactMatch: true }),
    router.resolve.idToEntity({ param: 'job', required: true }),
    controller.finish,
    afterFinishJobHook
  )

  server.post(
    '/:customer/job',
    middlewares,
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'task', required:true}),
    router.ensureAllowed({entity: {name: 'task'} }),
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
      router.requireSecret('task')
    ],
    (req, res, next) => {
      req.user = App.user
      req.origin = JobConstants.ORIGIN_SECRET
      next()
    },
    controller.create
    //audit.afterCreate('job',{ display: 'name' })
  )

  server.del(
    '/job/finished',
    middlewares,
    router.requireCredential('admin'),
    controller.removeFinished
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
        (err, job) => {
          if (err) { return res.send(500, err.message) }

          var jobs = []
          if (job != null) {
            jobs.push(job.publish('agent'))
          }
          res.send(200, { jobs })
          next()
        }
      )
    } else {
      const filter = dbFilter(query, { /** default **/ })
      filter.where.customer_id = customer._id.toString()
      filter.populate = 'user'

      Job.fetchBy(filter, (err, jobs) => {
        if (err) { return res.send(500, err) }
        let data = []
        jobs.forEach(job => data.push(job.publish()))
        res.send(200, data)
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
    var payload = req.body.result || {}

    App.jobDispatcher.finish({
      result: (payload.data || {}),
      state: payload.state,
      job: req.job,
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
    const { task, user, customer } = req
    const args = (req.body.task_arguments || [])

    logger.log('creating new job')

    const inputs = {
      task,
      user,
      customer,
      notify: true,
      origin: (req.origin || JobConstants.ORIGIN_USER),
      task_arguments_values: args,
      script_arguments: args
    }

    App.jobDispatcher.create(inputs, (err, job) => {
      if (err) {
        logger.error(err)
        return res.send(err.statusCode || 500, err.message)
      }

      let data
      if (job.agent && job.agenda.constructor.name === 'Agenda') {
        data = job.attrs
      } else {
        data = job.publish()
      }

      data.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }

      res.send(200, data)
      req.job = job
      next()
    })
  },
  removeFinished (req, res, next) {
    let customer = req.customer
    let query = req.query || {}

    if (/Workflow/.test(query.type)) {
      Job.aggregate([
        {
          $match: {
            workflow_id: query.id.toString(),
            customer_id: customer.id.toString()
          }
        }, {
          $group: {
            _id: '$workflow_job_id',
            tasksJobs: {
              $push: '$$ROOT'
            }
          }
        }, {
          $project: {
            //tasksJobs: 1,
            finished: {
              $allElementsTrue: {
                $map: {
                  input: '$tasksJobs',
                  as: 'taskjob',
                  in: {
                    $or: [
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.FINISHED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.TERMINATED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.CANCELED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.EXPIRED ] },
                      { $eq: [ '$$taskjob.lifecycle', LifecycleConstants.COMPLETED ] }
                    ]
                  }
                }
              }
            },
            _id: 1
          }
        }, {
          $match: {
            finished: true
          }
        }
      ]).exec((err, result) => {
        if (err) { return res.send(500, err) }

        result.forEach(wfJob => {
          Job.remove({
            $or: [
              { _id: { $eq: wfJob._id } },
              { workflow_job_id: { $eq: wfJob._id } }
            ]
          }, (err) => {
            if (err) { logger.error('%o', err) }
          })
        })
        res.send(200, {})
      })

    } else if (/Task/.test(query.type)) {
      Job.remove({
        task_id: query.id.toString(),
        $or: [
          { lifecycle: LifecycleConstants.FINISHED },
          { lifecycle: LifecycleConstants.TERMINATED },
          { lifecycle: LifecycleConstants.CANCELED },
          { lifecycle: LifecycleConstants.EXPIRED },
          { lifecycle: LifecycleConstants.COMPLETED }
        ]
      }, function (err) {
        if (err) { return res.send(500, err) }
        res.send(200, {})
      })
    } else {
      res.send(400, 'Entity type not found')
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
