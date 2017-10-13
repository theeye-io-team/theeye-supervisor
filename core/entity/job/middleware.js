//const App = require('../../app')
const logger = require('../../lib/logger')('entity:job')
const NotificationService = require('../../service/notification')

module.exports = {
  postSave: (job) => {
    logger.debug('job %s saved. sending sns/socket update', job._id)

    job.populate('user', err => {

      NotificationService.sendSNSNotification(job, {
        topic: 'jobs',
        subject: 'job_update'
      })

    })
  }
}
