
module.exports = (fn) => {
  return async (req, res, next) => {
    try {
      const { status, body } = await fn(req)

      res.send(status||200, body||'ok')

      next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
