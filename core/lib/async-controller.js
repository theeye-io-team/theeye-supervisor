
module.exports = (fn) => {
  return async (req, res, next) => {
    try {
      const result = await fn(req, res)
      const body = (result||'ok')
      res.send(body)
      next()
    } catch (err) {
      res.sendError(err)
    }
  }
}
