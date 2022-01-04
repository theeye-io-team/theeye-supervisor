const App = require('../app')
const { ServerError, ClientError } = require('./error-handler')

module.exports = (fn, options = {}) => {
  const controller = async (req, res, next) => {
    try {
      const result = await fn(req, res)
      const body = (result||'ok')
      res.send(body)
      next()
    } catch (err) {
      if (err.name === 'ValidationError') {
        const clientErr = new ClientError('Invalid Payload') 
        clientErr.errors = err.errors
        res.sendError(clientErr)
      } else {
        res.sendError(err)
      }
    }
  }

  return controller
}
