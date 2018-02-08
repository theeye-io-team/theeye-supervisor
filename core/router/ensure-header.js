const logger = require('../lib/logger')(':router:ensure-headers')

module.exports = (name, value) => {
  return function (req, res, next) {
    const reqHeadersNames = Object.keys(req.headers)
    let headerFound = false
    let found = reqHeadersNames.find(hname => hname === name.toLowerCase())

    if (found) {
      let regex = new RegExp(value)
      if (regex.test(req.headers[found]) === true) {
        headerFound = true
      }
    }

    if (!Boolean(headerFound)) {
      let msg = `invalid header '${name}':'${req.headers[found]}'. '${value}' expected`
      logger.error(msg)
      return res.send(400, msg)
    }

    next()
  }
}
