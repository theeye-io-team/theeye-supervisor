const App = require('../app')

const router = require('../router')

module.exports = (server) => {
  server.get('/:customer/tag',
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }),
    router.ensureCustomer,
    fetchTags
  )

  server.get('/tag',
    server.auth.bearerMiddleware,
    router.resolve.customerSessionToEntity(),
    router.ensureCustomer,
    fetchTags
  )
}

const fetchTags = async (req, res) => {
  try {
    const { customer } = req
    const tags = await App.Models.Tag.Tag
      .find({ customer: customer._id })
      .select({ name: 1 })

    res.send(200, tags)
  } catch (err) {
    res.sendError(err)
  }
}
