//const App = require('../../app')
const logger = require('../../lib/logger')('entity:job')
const NotificationService = require('../../service/notification')
const TopicsConstants = require('../../constants/topics')
const Constants = require('../../constants')

module.exports = {
  //postSave: (job) => {
  //  logger.debug('job %s saved. sending system event', job._id)
  //  job.populate('user', err => {
  //    const topic = TopicsConstants.job.crud
  //    elastic.submit(job.customer_name, topic, job) // topic = topics.job.crud
  //    NotificationService.generateSystemNotification({
  //      topic: topic,
  //      data: {
  //        hostname: job.hostname,
  //        organization: job.customer_name,
  //        //operation: isNew ?
  //        model_type: job._type,
  //        model: job
  //      }
  //    })
  //  })
  //}
}
