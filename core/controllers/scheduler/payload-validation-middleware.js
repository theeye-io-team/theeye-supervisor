const isDate = require('validator/lib/isDate')
const cronParser = require('cron-parser')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = (req, res, next) => {
  try {
    const body = req.body
    const { runDate, repeatEvery, timezone } = body

    if (!body) {
      throw new ClientError('Body parameters required')
    }

    if (!runDate && !repeatEvery) {
      throw new ClientError('Invalid request. runDate or repeatEvery needed.')
    }

    if (runDate && !isDate(runDate, new Date())) {
      throw new ClientError('runDate. Invalid date')
    }

    repeatEvery && parseCronExpression(repeatEvery)

    timezone && validateTimezone(timezone)

    next()
  } catch (err) {
    if (!err.statusCode || err.statusCode === 500) { logger.error(err) }
    res.sendError(err)
  }
}

const parseCronExpression = (expression) => {
  if (typeof expression !== 'string') {
    throw new ClientError('Invalid cron expression')
  }
  if (expression.trim().split(' ').length !== 5) {
    throw new ClientError('Invalid cron expression. 5 fields format supported')
  }

  try {
    cronParser.parseExpression(expression)
  } catch (err) {
    // convert cron error to ClientError
    throw new ClientError(`Invalid expression. ${err.message}`)
  }
}

const validateTimezone = (timeZone) => {
  try {
    const date = new Date()
    const locale = undefined
    date.toLocaleString(locale, { timeZone })
  } catch (err) {
    throw new ClientError(`Invalid timezone. ${err.message}`)
  }
}
