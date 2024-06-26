const App = require('../app')
const { ServerError, ClientError, AsyncMiddlewareEmptyResult } = require('./error-handler')

module.exports = (fn, options = {}) => {
  const controller = async (req, res) => {
    try {
      const result = await fn(req, res)
      if (result === undefined) {
        throw new AsyncMiddlewareEmptyResult('Internal Server Error')
      }
      const body = (result||'ok')
      res.send(body)
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
