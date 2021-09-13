const { PRIORITY_LEVELS } = require('../../constants/jobs')
const AsyncMiddleware = require('../../lib/async-middleware')
const { ClientError, ServerError } = require('../../lib/error-handler')

module.exports = AsyncMiddleware((req, res) => {
  const body = (req?.body || {})
  const { number, level } = body

  if (number === undefined && level === undefined) {
    throw new ClientError('A priority is needed')
  }

  if (number !== undefined && level !== undefined) {
    throw new ClientError('Level or Number?')
  }

  if (number !== undefined && (isNaN(number) || number < -21 || number > 21)) {
    throw new ClientError('Need a number between -21 and 21')
  }

  if (level !== undefined && Object.keys(PRIORITY_LEVELS).indexOf(level) === -1) {
    throw new ClientError('Need a valid priority level')
  }
})
