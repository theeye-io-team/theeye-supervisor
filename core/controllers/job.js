'use strict'

const App = require('../app')
const json = require('../lib/jsonresponse')
const debug = require('../lib/logger')('controller:job')
const router = require('../router')
const Job = require('../entity/job').Job

module.exports = (server, passport) => {
  var middlewares = [
    passport.authenticate('bearer', {session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  server.put('/:customer/job/:job', middlewares.concat(
    router.requireCredential('agent',{exactMatch:true}),
    router.resolve.idToEntity({param:'job',required:true})
  ), controller.update)

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

  server.post('/:customer/job', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'task',required:true}),
    router.ensureAllowed({entity:{name:'task'}})
  ), controller.create)
}

const controller = {
  get (req,res,next) {
    var job = req.job;
    res.send(200,{ job: job })
  },
  fetch (req,res,next) {
    debug.log('querying jobs')

    const host = req.host
    if (!host) {
      debug.log('host %s not found', req.params.hostname)
      return res.send(404, 'host is not valid')
    }
    const customer = req.customer
    const input = { host: req.host }

    if (req.params.process_next) {
      App.jobDispatcher.getNextPendingJob(input,function(error,job){
        var jobs = []
        if (job != null) jobs.push(job)
        res.send(200, { jobs : jobs })
      })
    } else {
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
      return res.send(400, json.error('result data is required'))
    }

    App.jobDispatcher.update(req.job, result, (err, job) => {
      if (err) return res.send(500)
      res.send(200, job)
      next()
    })
  },
  create (req,res,next) {
    var task = req.task
    var user = req.user
    var customer = req.customer

    debug.log('new task received')

    App.jobDispatcher.create({
      task: task,
      user: user,
      customer: customer,
      notify: true
    }, (error,job) => {
      if (error) {
        if (error.statusCode) {
          if (error.statusCode===423) {
            return res.send(error.statusCode, job)
          } else {
            debug.log(error)
            return res.send(error.statusCode, error.message)
          }
        } else {
          debug.log(error)
          return res.send(500)
        }
      }
      res.send(200,job)
    })
  }
}
