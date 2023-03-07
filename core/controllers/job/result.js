const App = require('../../app')
const router = require('../../router')
const AsyncMiddleware = require('../../lib/async-controller')
const qs = require('qs')

module.exports = (server) => {

  server.get('/job/:job/result',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    resultHandler
  )

  server.post('/job/:job/result',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    resultHandler
  )

}

const resultHandler = (req, res, next) => {
  try {
    const { job, customer } = req
    if (!job) {
      throw new ClientError('Job not found', { statusCode: 404 })
    }

    if (App.jobDispatcher.hasFinished(job) === true) {
      const result = prepareJobResponse(job, req.query)
      res.send(200, result.data)
      next()
    } else {
      waitJobResult(job, customer, req.query.timeout, (err, message) => {
        if (!message) {
          if (req.query.limit === req.query.counter) {
            res.send(408, 'Request Timeout')
          } else {
            // the message did not arrived
            const query = Object.assign({}, req.query)
            let counter = Number(req.query.counter)
            query.counter = (isNaN(counter)) ? 0 : counter + 1

            const encodedquerystring = qs.stringify(query)

            res.header('Location', `/job/${job.id}/result?${encodedquerystring}`)
            res.send(303, {})
          }
        } else {
          App.Models.Job
            .Job
            .findById(job._id)
            .then(job => {
              const result = prepareJobResponse(job, req.query)
              res.send(200, result.data)
              next()
            })
        }
      })
    }
  } catch (err) {
    res.sendError(err)
  }
}

const waitJobResult = async (job, customer, timeout, next) => {

  if (!timeout || timeout < 5 || timeout > job.timeout) {
    timeout = job.timeout // seconds. arbitrary
  }

  timeout = (timeout * 1000)

  let timerId
  let channel

  const stopWaiting = async (message) => {
    try {
      clearTimeout(timerId)
      App.redis.unsubscribe(channel)
    } catch (err) {
      console.log(err)
    }

    try {
      message = JSON.parse(message)
    } catch (err) {
      message = undefined
    }

    if (message === undefined) {
      next()
    } else {
      // we got the result
      next(null, message)
    }
  }

  channel = `${customer.id}:job-finished:${job.id}`
  App.redis.subscribe(channel, stopWaiting)

  timerId = setTimeout(() => {
    stopWaiting()
  }, timeout)
}

const prepareJobResponse = (job, options) => {
  const result = {}

  if (options.hasOwnProperty('result')) {
    result.data = job.result
  } else if (options.hasOwnProperty('full')) {
    result.data = job
  } else {
    const output = job.output
    if (options.hasOwnProperty('parse')) {
      const index = (options.parse || 0)
      if (Array.isArray(output)) {
        try {
          const respData = JSON.parse(output[index]) // first index
          result.data = respData
          result.statusCode = respData?.statusCode
        } catch (jsonErr) {
          logger.log('output cannot be parsed')
          result.data = output
        }
      }
    } else {
      result.data = output
    }
  }

  if (!result.statusCode) {
    // default. the job was executed
    if (job.state !== 'success') {
      result.statusCode = 500
    } else {
      result.statusCode = 200
    }
  }

  return result
}

