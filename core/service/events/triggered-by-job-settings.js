const App = require('../../app')
const ObjectId = require('mongoose').Types.ObjectId

module.exports = (job) => {
  let user // the owner of the execution
  let dynamic_settings = null // if the event was emitted by a job

  if (job) { // event triggered by a job
    if (job.next) {
      dynamic_settings = job.next
    }

    if (job.user_id) {
      user = {
        _id: new ObjectId(job.user_id),
        id: job.user_id.toString()
      }
    }
  } else {
    user = App.user
  }

  return { user, dynamic_settings }
}
