const App = require('../../app')
const ObjectId = require('mongoose').Types.ObjectId

module.exports = async (job) => {
  let user // the owner of the execution
  let dynamic_settings = null // if the event was emitted by a job

  if (job) { // event triggered by a job
    if (job.next) {
      dynamic_settings = job.next
    }

    if (job.user_id) {
      const gwusers = await App.gateway.user.fetch(
        [ job.user_id ],
        { customer_id: job.customer_id }
      )

      user = {
        _id: new ObjectId(job.user_id),
        id: job.user_id.toString(),
        username: gwusers[0].username,
        email: gwusers[0].email
      }
    }
  } else {
    user = {}
  }

  return { user, dynamic_settings }
}
