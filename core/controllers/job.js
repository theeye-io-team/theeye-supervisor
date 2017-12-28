'use strict'

const App = require('../app')
const json = require('../lib/jsonresponse')
const logger = require('../lib/logger')('controller:job')
const router = require('../router')
const Job = require('../entity/job').Job
const TaskConstants = require('../constants/task')
const JobConstants = require('../constants/jobs')
const audit = require('../lib/audit')

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
  server.get('/:customer/job/:job', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'job',required:true})
  ), controller.get)

  server.get('/:customer/job', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.hostnameToHost({required:true})
  ), controller.fetch)

  //server.patch( // should be patch
  server.put(
    '/:customer/job/:job',
    middlewares.concat(
      router.requireCredential('agent',{exactMatch:true}),
      router.resolve.idToEntity({param:'job',required:true})
    ),
    controller.update
    //audit.afterUpdate('job',{ display: 'name' })
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
}

const controller = {
  get (req,res,next) {
    var job = req.job;
    res.send(200,{ job: job })
  },
  fetch (req,res,next) {
    logger.log('querying jobs')

    const host = req.host
    if (!host) {
      logger.log('host %s not found', req.params.hostname)
      return res.send(404, 'host is not valid')
    }
    const customer = req.customer
    const input = {
      host: req.host,
      user: req.user
    }

    if (req.params.process_next) {
      App.jobDispatcher.getNextPendingJob(input,function(error,job){
        var jobs = []
        if (job != null) jobs.push(job)
        res.send(200, { jobs : jobs })
      })
    } else {
      // find all
      Job.find({
        host_id: host.id,
        customer_name: customer.name
      }).exec(function(err,jobs){
        res.send(200, { jobs : jobs })
      })
    }
  },
  update (req, res, next) {
    var result = req.params.result
    if (!result) {
      return res.send(400, 'result data is required')
    }

    if (!result.state && !result.data) return res.send(400)

    App.jobDispatcher.update({
      job: req.job,
      result: result,
      user: req.user,
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
  create (req,res,next) {
    const task = req.task

    let jobData = {
      task: task,
      user: req.user,
      customer: req.customer,
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
