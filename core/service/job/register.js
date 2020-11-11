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
 * @return {Promise}
 */
module.exports = async (operation, topic, input) => {
  const { job, user } = input
  const task = (job.task || {})

  await job.populate([
    { path: 'host', select: 'id hostname' },
    { path: 'workflow_job' },
  ]).execPopulate()

  const payload = prepareLog({ job, task, user })
  payload.operation = operation
  App.logger.submit(job.customer_name, topic, payload)

  // skip system notifications for this job.
  if (job.notify !== false) {
    // async call
    App.notifications.generateSystemNotification({
      topic,
      data: {
        operation,
        hostname: (job.host && job.host.hostname) || job.host_id,
        organization: job.customer_name,
        organization_id: job.customer_id,
        model_id: job._id,
        model_type: job._type,
        model: job.toObject(),
        approvers: (task && task.approvers) || undefined
      }
    })
  }

  return
}

const prepareLog = ({ job, task, user }) => {
  const payload = {
    operation: null,
    hostname: (job.host && job.host.hostname) || job.host_id,
    task_id: task._id,
    task_name: task.name,
    task_type: task.type,
    approvers: (task && task.approvers) || undefined,
    state: job.state,
    lifecycle: job.lifecycle,
    organization: job.customer_name,
    organization_id: job.customer_id,
    job_type: job._type
  }

  if (user) {
    payload.user_id = (user._id || user.id)
    payload.user_email = user.email
    payload.user_name = user.username
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
    throw new Error(`job ${job._id}/${job._type} task is not valid or undefined`)
  }

  if (job._type === JobConstants.SCRAPER_TYPE) {
    //payload.url = task.url
    //payload.method = task.method
    //payload.statuscode = task.status_code
    //payload.pattern = task.pattern
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

  if (job.result) {
    // clone result to avoid removing the original data
    payload.result = JSON.parse(JSON.stringify(job.result))
    if (job._type == JobConstants.SCRAPER_TYPE) {
      if (payload.result.response && payload.result.response.body) {
        delete payload.result.response.body
      }
    }
  }

  return payload
}
