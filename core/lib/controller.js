
module.exports = (fn) => {
  return async (req, res, next) => {
    try {
      const result = await fn(req)
      const { status, body } = (result || { status: 200, body: 'ok' })
      res.send(status, body)
      next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
