'use strict'

const debug = require('../lib/logger')('controller:job-lifecycle')
const router = require('../router')
const LIFECYCLE = require('../constants/lifecycle')

/**
 * @summary Job.lifecycle property CRUD
 * @namespace Controller
 * @module Job:Lifecycle
 */
module.exports = (server, passport) => {
  const middlewares = [
    passport.authenticate('bearer',{session:false}),
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer
  ]

  // obtain job current lifecycle
  server.get('/:customer/job/:job/lifecycle', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'job',required:true})
  ), controller.get)

  server.put('/:customer/job/:job/lifecycle/:lifecycle', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'job',required:true})
  ), controller.update)

  server.put('/:customer/job/:job/cancel', middlewares.concat(
    router.requireCredential('user'),
    router.resolve.idToEntity({param:'job',required:true})
  ), controller.cancel)
}

const controller = {
  get (req, res, next) {
    res.send(200, req.job.lifecycle)
  },
  update (req, res, next) {
    const job = req.job
    const lifecycle = req.params.lifecycle

    if (!lifecycle) {
      return res.send(400,'lifecycle value is required')
    }

    job.lifecycle = lifecycle
    job.save(err => {
      if (err) {
        logger.error('Failed to update job lifecycle')
        logger.error(err)
        return res.send(500)
      }

      return res.send(200, job.lifecycle)
    })
  },
  cancel (req, res, next) {
    const job = req.job
    job.lifecycle = LIFECYCLE.CANCELED
    job.save(err => {
      if (err) {
        logger.error('Failed to cancel job')
        logger.error(err)
        return res.send(500)
      }

      return res.send(200, job.lifecycle)
    })
  }
}
