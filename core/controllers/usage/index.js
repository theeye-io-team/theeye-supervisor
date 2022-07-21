const App = require('../../app')
const router = require('../../router')
const logger = require('../../lib/logger')('eye:controller:usage')
const dbFilter = require('../../lib/db-filter')

module.exports = function (server) {
  const middlewares = [
    server.auth.bearerMiddleware,
    router.resolve.customerNameToEntity({ required: true }), // use customer name or id to resolve
    router.ensureCustomer
  ]

  server.get('/usage/counters',
    middlewares,
    router.requireCredential('admin'),
    usageCount
  )

  server.get('/usage/details',
    middlewares,
    router.requireCredential('admin'),
    usageDetails
  )

  //
  // admin can query different customers with a root token
  //
  server.get('/admin/usage/counters',
    server.auth.bearerMiddleware,
    router.requireCredential('root'),
    //(req, res, next) => {
    //  if (!req.query.usageToken) {
    //    res.send(403, 'Forbidden')
    //    return
    //  }
    //  return next()
    //},
    router.resolve.customerToEntity({ required: true }), // use customer name or id to resolve
    usageCount
  )

  server.get('/admin/usage/details',
    server.auth.bearerMiddleware,
    router.requireCredential('root'),
    //(req, res, next) => {
    //  if (!req.query.usageToken) {
    //    res.send(403, 'Forbidden')
    //    return
    //  }
    //  return next()
    //},
    router.resolve.customerToEntity({ required: true }), // use customer name or id to resolve
    usageDetails
  )

  server.get('/admin/usage/jobs',
    server.auth.bearerMiddleware,
    router.requireCredential('root'),
    jobUsageDetails
  )
}

const jobUsageDetails = async (req, res, next) => {
  try {
    const input = req.query
    const filters = dbFilter(input, { /** default **/ })

    const jobs = await new Promise((resolve, reject) => {
      App.Models.Job.Job.fetchBy(filters, (err, jobs) => {
        if (err) reject(err)
        else resolve(jobs)
      })
    })

    const sizes = []
    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index]

      const data = [
        job.output,
        job.result,
        job.task_arguments_values
      ]

      const iosize = Buffer.byteLength(JSON.stringify(data), 'utf8')
      if (iosize > 3000) {
        sizes.push({ _id: job._id, customer_name: job.customer_name, name: job.name, iosize })
      }
    }

    res.send(200, sizes)
  } catch (err) {
    res.sendError(err)
  }
}

const usageCount = async (req, res, next) => {
  try {
    const customer = req.customer
    const queryPromise = []

    let usage = await Promise.all([
      Tasks.usageCount(customer),
      Monitors.usageCount(customer),
      Webhooks.usageCount(customer),
      Hosts.usageCount(customer)
    ])

    res.send({
      tasks    : usage[0] && usage[0][0],
      monitors : usage[1] && usage[1][0],
      webhooks : usage[2] && usage[2][0],
      bots     : usage[3] && usage[3][0]
    })
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const usageDetails = async (req, res, next) => {
  try {
    const customer = req.customer

    let usage = await Promise.all([
      Tasks.usageDetails(customer),
      Monitors.usageDetails(customer),
      Webhooks.usageDetails(customer),
      Hosts.usageDetails(customer)
    ])

    res.send({
      tasks    : usage[0],
      monitors : usage[1],
      webhooks : usage[2],
      bots     : usage[3]
    })
  } catch (err) {
    logger.error(err)
    res.send(500, 'Internal Server Error')
  }
}

const Hosts = {
  usageCount (customer) {
    return App.Models.Host.Host.aggregate([
      { $match: { customer_id: customer._id.toString() } },
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ])
  },
  usageDetails (customer) {
    return App.Models.Host.Host.aggregate([
      { $match: { customer_id: customer._id.toString() } },
      {
        $project: {
          _id: 1,
          bot_name: "$hostname",
          creation_date: 1
        }
      },
      { $sort: { _id: 1 } }
    ])
  }
}

const Tasks = {
  /**
   * @return Promise
   */
  usageCount (customer) {
    return App.Models.Task.Task.aggregate([
      {
        $match: { customer: customer._id }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          query_count: { $sum: "$execution_count" } 
        } 
      },{ $project: { _id: 0 } }
    ])
  },

  /**
   * @return Promise
   */
  usageDetails (customer) {
    return App.Models.Task.Task.aggregate([
      {
        $match: { customer: customer._id }
      },
      {
        $lookup: {
          from: "hosts",
          localField: "host",
          foreignField: "_id",
          as: "bot"
        }
      },
      // can $unwind only if $lookup return an array with a single document, as expected
      {
        $unwind: "$bot"
      },
      {
        $project: {
          bot_name: "$bot.hostname",
          bot_id: "$host_id",
          name: "$name",
          type: "$type",
          creation_date: 1,
          query_count: "$execution_count"
        } 
      },
      { $sort: { _id: 1 } }
    ])
  }
}

const Monitors = {
  /**
   * @return Promise
   */
  usageCount (customer) {
    return App.Models.Monitor.Monitor.aggregate([
      {
        $match: {
          customer: customer._id,
          looptime: { $ne: 0 }
        }
      },
      {
        $lookup: {
          from: "resources",
          localField: "resource",
          foreignField: "_id",
          as: "resource"
        }
      },
      { $unwind: "$resource" },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          recovery_count: { $sum: "$resource.recovery_count" },
          query_count: {
            $sum: {
              $ceil: {
                $divide: [
                  {
                    $subtract: [ new Date(), "$creation_date" ]
                  },
                  "$looptime"
                ]
              }
            }
          }
        } 
      },
      {
        $project: { _id: 0 }
      }
    ])
  },

  /**
   * @return Promise
   */
  usageDetails (customer) {
    return App.Models.Monitor.Monitor.aggregate([
      {
        $match: {
          customer: customer._id,
          looptime: { $ne: 0 }
        }
      },
      {
        $lookup: {
          from: "resources",
          localField: "resource",
          foreignField: "_id",
          as: "resource"
        }
      },
      { $unwind: "$resource" },
      {
        $project: {
          bot_name: "$hostname",
          type: "$type",
          name: "$name",
          creation_date: 1,
          state: "$resource.state",
          recovery_count: { $sum: "$resource.recovery_count" },
          looptime: "$looptime",
          query_count: {
            $ceil: {
              $divide: [
                {
                  $subtract: [ new Date(), "$creation_date" ]
                },
                "$looptime"
              ]
            }
          }
        } 
      },
      { $sort: { _id: 1 } }
    ])
  }
}

const Webhooks = {
  /**
   * @return Promise
   */
  usageCount (customer) {
    return App.Models.Webhook.Webhook.aggregate([
      {
        $match: { customer: customer._id }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          query_count: { $sum: "$trigger_count" } 
        } 
      },
      { $project: { _id: 0 } }
    ])
  },

  /**
   * @return Promise
   */
  usageDetails (customer) {
    return App.Models.Webhook.Webhook.aggregate([
      {
        $match: { customer: customer._id }
      },
      {
        $project: {
          webhook_name: "$name",
          query_count: "$trigger_count"
        } 
      },
      { $sort: { _id: 1 } }
    ])
  }
}
