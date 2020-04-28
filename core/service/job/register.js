const App = require('../../app')
const JobConstants = require('../../constants/jobs')
const TopicsConstants = require('../../constants/topics')
const logger = require('../../lib/logger')('service:jobs')

/**
 * @summary register job operation and notify
 *
 * @param {String} operation
 * @param {String} topic
 * @param {Object} input
 * @property {Job} input.job
 *
 */
module.exports = (operation, topic, input, done) => {
  done || (done = () => {})

  const { job } = input

  /**
   * @param {Object} jobData plain object
   */
  const sendJobNotification = (jobData) => {
    let job = jobData
    let task = (jobData.task || {})

    const payload = {
      operation,
      task_name: task.name,
      task_type: task.type,
      state: job.state,
      lifecycle: job.lifecycle,
      organization: job.customer_name,
      job_type: job._type
    }

    if (job.user) {
      payload.user_id = job.user._id
      payload.user_name = job.user.username
      payload.user_email = job.user.email
    } else {
      logger.error(`job user not defined. ${job._id} ${topic} ${job.name}`)
    }

    if (
      job._type !== JobConstants.APPROVAL_TYPE &&
      job._type !== JobConstants.DUMMY_TYPE &&
      job._type !== JobConstants.NOTIFICATION_TYPE
    ) {
      if (job.host) {
        payload.hostname = job.host.hostname
      } else {
        logger.error(new Error(`job ${job._id}/${job._type}. host not available must fix`))
      }
    }

    if (App.jobDispatcher.jobMustHaveATask(job) && !task) {
      let err = new Error(`job ${job._id}/${job._type} task is not valid or undefined`)
      throw err
    }

    if (job._type === JobConstants.SCRAPER_TYPE) {
      payload.url = task.url
      payload.method = task.method
      payload.statuscode = task.status_code
      payload.pattern = task.pattern
    } else if (job._type == JobConstants.SCRIPT_TYPE) {
      if (!job.script) {
        const msg = `job ${job._id}/${job._type} script is not valid or undefined`
        logger.error(new Error(msg))
      } else {
        const script = job.script || {}
        payload.filename = script.filename
        payload.md5 = script.md5
        payload.mtime = script.last_update
        payload.mimetype = script.mimetype
      }
    } else if (job._type == JobConstants.APPROVAL_TYPE) {
      // nothing yet
    } else if (job._type == JobConstants.DUMMY_TYPE) {
      // nothing yet
    } else if (job._type == JobConstants.NOTIFICATION_TYPE) {
      // nothing yet
    } else if (job._type == JobConstants.AGENT_UPDATE_TYPE) {
      // nothing yet
    } else {
      // unhandled job type
    }

    // async call
    App.notifications.generateSystemNotification({
      topic: TopicsConstants.job.crud,
      data: {
        hostname: (job.host && job.host.hostname) || job.host_id,
        organization: job.customer_name,
        operation: operation,
        model_type: job._type,
        model: job,
        approvers: (task && task.approvers) || undefined
      }
    })

    if (job.result) {
      payload.result = job.result
      if (job._type == JobConstants.SCRAPER_TYPE) {
        if (payload.result.response && payload.result.response.body) {
          delete payload.result.response.body
        }
      }
    }

    // async call
    // topic = topics.task.[execution||result] , CREATE/UPDATE
    App.logger.submit(job.customer_name, topic, payload)
    return
  }

  jobPopulate(job, (err, users) => {
    if (err) { return done(err) }

    let data = job.toObject()
    data.user = users.job_user

    if (users.workflowJobUser) {
      data.workflow_job.user = users.workflow_user
    }

    sendJobNotification(data)
    done()
  })
}

const jobPopulate = (job, next) => {
  job.populate([
    { path: 'host', select: 'id hostname' },
    { path: 'user', select: 'id email username' },
    { path: 'workflow_job' },
  ], (err) => {
    if (err) { return next(err) }

    if (!job.user) { return next(null, {}) }
    let job_user = job.user.toObject()

    if (job.workflow_job && job.workflow_job.user) {
      job.workflow_job.populate([
        { path: 'user', select: 'email username id' }
      ], (err) => {
        if (err) { return next(err) }

        let workflow_user = job.workflow_job.user.toObject()

        return next(null, { job_user, workflow_user })
      })
    } else {
      return next(null, { job_user })
    }
  })
}
