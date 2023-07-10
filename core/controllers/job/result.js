const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:job')
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
    resultPolling
  )

  server.post('/job/:job/result',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({required:true}),
    router.ensureCustomer,
    router.requireCredential('viewer'),
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.ensureAllowed({ entity: { name: 'job' } }),
    resultPolling
  )
}

const resultPolling = (req, res, next) => {
  try {
    const { job, customer } = req
    if (!job) {
      throw new ClientError('Job not found', { statusCode: 404 })
    }

    if (App.jobDispatcher.hasFinished(job) === true) {
      const result = prepareJobResponse(job, req.query)
      res.send(result?.statusCode, result?.data)
      next()
    } else {
      waitJobResult(req, job, customer, req.query.timeout, (err, message) => {
        if (err) {
          res.send(408, 'Request Timeout')
        } else if (!message) {
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
              if (!job) {
                throw new ClientError('Job result is no longer available', { statusCode: 404 })
              }

              const result = prepareJobResponse(job, req.query)
              res.send(result?.statusCode, result?.data)
              next()
            })
        }
      })
    }
  } catch (err) {
    res.sendError(err)
  }
}

const waitJobResult = async (req, job, customer, timeout, next) => {

  let isWaiting

  if (!timeout || timeout > 60) {
    timeout = 60 // seconds. arbitrary
  } else if (timeout < 10) {
    timeout = 10
  }

  timeout = (timeout * 1000)

  let timerId
  let channel

  const stopWaiting = async (err, message) => {
    try {
      clearTimeout(timerId)
      App.redis.unsubscribe(channel)
      isWaiting = false
    } catch (err) {
      console.log(err)
    }

    try {
      message = JSON.parse(message)
    } catch (err) {
      message = undefined
    }

    next(err, message)
  }

  req.socket.on("error", function() {
    if (isWaiting === true) {
      stopWaiting(new Error('connection closed. stop waiting'))
    }
  })
  // this event is always emitted
  req.socket.on("end", function() {
    if (isWaiting === true) {
      stopWaiting(new Error('connection closed. stop waiting'))
    }
  })

  isWaiting = true
  channel = `${customer.id}:job-finished:${job.id}`
  App.redis.subscribe(channel, message => stopWaiting(null, message))

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
          const arg = output[index]
          let respData
          if (arg) {
            respData = JSON.parse(arg) // first index
          }

          result.data = respData || null
          result.statusCode = (respData?.statusCode || respData?.status)
        } catch (jsonErr) {
          result.data = {
            message: 'task ejecution result cannot be parsed',
            result: job.result
          }
          result.statusCode = 500
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

