const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('controller:job')
const { ClientError } = require('../../lib/error-handler')
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

  server.get('/job/:job/secret/:secret/result',
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.requireSecret('job'),
    (req, res, next) => {
      req.job
        .populate('customer')
        .execPopulate()
        .then(() => {
          req.customer = req.job.customer
          req.user = App.user
          //req.origin = JobConstants.ORIGIN_SECRET
          next()
        })
        .catch(err => {
          res.sendError(err)
        })
    },
    resultPolling
  )

  server.post('/job/:job/secret/:secret/result',
    router.resolve.idToEntity({ param: 'job', required: true }),
    router.requireSecret('job'),
    (req, res, next) => {
      req.job
        .populate('customer')
        .execPopulate()
        .then(() => {
          req.customer = req.job.customer
          req.user = App.user
          //req.origin = JobConstants.ORIGIN_SECRET
          next()
        })
        .catch(err => {
          res.sendError(err)
        })
    },
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
      return sendResponse(res, parseJobResponse(job, req.query), next)
    } else {
      waitJobResult(req, job, customer, req.query.timeout, (err, message) => {
        if (err) {
          res.send(408, 'Request Timeout')
          return
        } else if (!message) {
          if (req.query.limit === req.query.counter) {
            res.send(408, 'Request Timeout')
            return
          } else {
            // the message did not arrived
            const query = Object.assign({}, req.query)
            let counter = Number(req.query.counter)
            query.counter = (isNaN(counter)) ? 0 : counter + 1

            const encodedquerystring = qs.stringify(query)

            // started by secret. use job secret
            let redirectUrl
            if (req.params.secret) {
              redirectUrl = `/job/${job.id}/secret/${job.secret}/result`
            } else {
              redirectUrl = `/job/${job.id}/result`
            }

            res.header('Location', `${redirectUrl}?${encodedquerystring}`)
            res.send(303, {})
            return
          }
        } else {
          App.Models.Job
            .Job
            .findById(job._id)
            .then(job => {
              if (!job) {
                throw new ClientError('Job result is no longer available', { statusCode: 404 })
              }

              return sendResponse(res, parseJobResponse(job, req.query), next)
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
  let timerId
  let channel

  if (!timeout || timeout > 60) {
    timeout = 60 // seconds. arbitrary
  } else if (timeout < 10) {
    timeout = 10
  }

  timeout = (timeout * 1000)

  const stopWaiting = async (err, message) => {
    if (!isWaiting) {
      logger.error('already stopped waiting. loop ended')
      return
    } 

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

const parseJobResponse = (job, options) => {
  const result = {}

  if (options.hasOwnProperty('result')) {
    result.body = job.result
  } else if (options.hasOwnProperty('full')) {
    result.body = job
  } else if (options.hasOwnProperty('output')) {
    result.body = job.output
  } else {
    const output = job.output
    const index = (options.parse || 0)
    if (Array.isArray(output)) {
      try {
        const arg = output[index]
        let respData
        if (arg) {
          respData = JSON.parse(arg) // first index
        }

        if (respData?.response) {
          result.body = respData.response?.body || respData.response
          result.statusCode = respData.response?.statusCode
          result.headers = respData.response?.headers
        } else {
          result.body = respData || null
          if (typeof respData?.statusCode === 'number') {
            result.statusCode = respData.statusCode
          }
        }
      } catch (jsonErr) {
        result.body = {
          message: 'Invalid task ejecution result. Cannot be parsed',
          details: jsonErr.message,
          result: job.result
        }
        result.statusCode = 500
      }
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

const sendResponse = (res, result, next) => {
  if (result.headers) {
    for (let header in result.headers) {
      res.header(header, result.headers[header])
    }
  }
  res.send(result.statusCode, result.body)
  return next()
}
