const App = require('../app')

module.exports = (fn, options = {}) => {

  const controller = async (req, res, next) => {
    try {
      const result = await fn(req, res)
      const body = (result||'ok')
      res.send(body)
      next()
    } catch (err) {
      res.sendError(err)
    }
  }

  //const transactionalController = async (req, res, next) => {
  //  const db = App.db
  //  const session = await db.startSession()
  //  req.db_session = session
  //  try {
  //    session.startTransaction()
  //    const result = await fn(req, res)
  //    await session.commitTransaction()
  //    const body = (result||'ok')
  //    res.send(body)
  //    next()
  //  } catch (err) {
  //    await session.abortTransaction()
  //    res.sendError(err)
  //  }
  //  session.endSession()
  //}

  //return (options.withTransaction === true) ? transactionalController : controller
  return controller
}
