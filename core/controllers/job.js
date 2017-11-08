'use strict'

const App = require('../app')
const json = require('../lib/jsonresponse')
const logger = require('../lib/logger')('controller:job')
const router = require('../router')
const Job = require('../entity/job').Job
const Script = require('../entity/file').Script
const TASK = require('../constants/task')
const ErrorHandler = require('../lib/error-handler');

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
    logger.log('querying jobs')

    const host = req.host
    if (!host) {
      logger.log('host %s not found', req.params.hostname)
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

    let script
    let jobData = {
      task: task,
      user: req.user,
      customer: req.customer,
      notify: true
    }

    const prepareScript = (next) =>  {
      if (task.type===TASK.TYPE_SCRIPT) {
        const query = Script.findById(task.script_id)
        query.exec((err, script) => {
          if (err) {
            logger.error('%o',err)
            return res.send(500,err.message)
          }

          if (!script) {
            logger.error('script not found')
            return res.send(503,'the script for this task is no longer available')
          }

          jobData.script = script
          prepareTaskArgumentsValues(
            task.script_arguments,
            req.params.task_arguments || [],
            (err,args) => {
              if (err) {
                return res.sendError(err)
              }
              jobData.script_arguments = args
              next(null,jobData)
            }
          )
        })
      } else {
        next(null,jobData)
      }
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
      })
    }

    prepareScript( () => {
      createJob()
    })
  }
}

/**
 *
 * @param {Object[]} argumentsDefinition stored definition
 * @param {Object{}} argumentsValues user provided values
 * @param {Function} next callback
 *
 */
const prepareTaskArgumentsValues = (argumentsDefinition,argumentsValues,next) => {
  let errors = new ErrorHandler()
  let filteredArguments = []

  argumentsDefinition.forEach( (def,index) => {
    if (Boolean(def)) { // is defined
      if (typeof def === 'string') { // fixed value old version compatibility
        filteredArguments[index] = def
      } else if (def.type) {

        const order = (def.order || index) // if is not defined, it is the order the argument is being processed

        if (def.type===TASK.ARGUMENT_TYPE_FIXED) {
          filteredArguments[order] = def.value
        } else if (
          def.type === TASK.ARGUMENT_TYPE_INPUT ||
          def.type === TASK.ARGUMENT_TYPE_SELECT
        ) {
          // require user input
          const found = argumentsValues.find(reqArg => {
            return (reqArg.order === order && reqArg.label === def.label)
          })

          // the argument is not present within the provided request arguments
          if (!found) {
            errors.required(def.label, null, 'task argument ' + def.label + ' is required. provide the argument order and label')
          } else {
            if (!found.value) {
              errors.invalid(def.label, def.value, 'task argument value required')
            } else {
              filteredArguments[order] = found.value
            }
          }
        } else { // bad argument definition
          errors.invalid('arg' + index, def, 'task argument ' + index + ' definition error. unknown type')
          // error ??
        }
      } else { // argument is not a string and does not has a type
        errors.invalid('arg' + index, def, 'task argument ' + index + ' definition error. unknown type')
        // task definition error
      }
    }
  })

  if (errors.hasErrors()) {
    const err = new Error('invalid task arguments')
    err.statusCode = 400
    err.errors = errors
    return next(err)
  }
  next(null,filteredArguments)
}
