'use strict'

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
      router.resolve.hostnameToHost({ required: true })
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

  server.post(
    '/:customer/job',
    middlewares.concat(
      router.requireCredential('user'),
      router.resolve.idToEntity({param:'task',required:true}),
      router.resolve.idToEntity({param:'workflow'}),
      router.ensureAllowed({entity:{name:'task'}}),
      router.ensureAllowed({entity:{name:'workflow'}, required: false})
    ),
    controller.create
    //audit.afterCreate('job',{ display: 'name' })
  )
}

const controller = {
  get (req,res,next) {
    var job = req.job
    res.send(200, job)
  },
  fetch (req,res,next) {
    const host = req.host
    const customer = req.customer
    const user = req.user

    logger.log('querying jobs')

    if (req.params.process_next) {
      App.jobDispatcher.getNextPendingJob(
        { customer, host, user },
        (err,job) => {
          if (err) {
            return res.send(500, err.message)
          }

          var jobs = []
          if (job != null) jobs.push(job)
          res.send(200, { jobs })
        }
      )
    } else {
      // find all
      Job.find({
        host_id: host.id,
        customer_name: customer.name
      }).exec(function(err,jobs){
        res.send(200, { jobs })
      })
    }
  },
  finish (req, res, next) {
    var result = req.params.result || {}
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
   * @param {Object[]} req.params.task_arguments an array of objects with { order, label, value } arguments definition
   *
   */
  create (req, res, next) {
    let { task, workflow, user, customer } = req

    const jobData = {
      workflow,
      task,
      user,
      customer,
      notify: true,
      origin: JobConstants.ORIGIN_USER
    }

    const createJob = () => {
      logger.log('creating new job')
      App.jobDispatcher.create(jobData, (error,job) => {
        if (error) {
          if (error.statusCode) {
            if (error.statusCode===423) {
              return res.send(error.statusCode, job)
            } else {
              logger.error(error)
              return res.send(error.statusCode, error.message)
            }
          } else {
            logger.error(error)
            return res.send(500)
          }
        }
        res.send(200,job)
        req.job = job
        next()
      })
    }

    const prepareTaskArguments = (next) => {
      if (task.type === TaskConstants.TYPE_SCRIPT) {
        App.taskManager.prepareTaskArgumentsValues(
          task.script_arguments,
          req.params.task_arguments || [],
          (err,args) => {
            if (err) {
              return res.sendError(err)
            }
            jobData.script_arguments = args
            next()
          }
        )
      } else {
        next()
      }
    }

    prepareTaskArguments(() => { createJob() })
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
