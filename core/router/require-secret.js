module.exports = function (model) {
  return function (req, res, next) {
    const secret = req.params.secret
    if (!secret) {
      return res.send(403,'secret is required')
    }

    if (secret.length !== 64) {
      return res.send(403,'invalid secret')
    }

    if (
      typeof req[model] !== 'object' ||
      ! req[model].hasOwnProperty('secret')
    ) {
    }

    if (req[model].secret !== secret) {
      return res.send(403,'invalid secret')
    }

    next()
  }
}
