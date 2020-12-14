
const WS = require('../workspace/workspace')
const assert = require('chai').assert

WS().then(async App => {
  const eventId = process.argv[2]
  const jobId = process.argv[3]

  const event = await App.Models.Event.Event.findById(eventId)
  const job = await App.Models.Job.Job.findById(jobId)

  const payload = {
    topic: "workflow-execution",
    data: ["arg1","arg2","arg3","arg4"],
    event,
    job
  }

  await App.eventDispatcher.dispatch(payload)

  //await App.db.close()
})
