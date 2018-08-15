const App = require('../../app')
const JobModels = require('../../entity/job')
const Script = require('../../entity/file').Script
const LifecycleConstants = require('../../constants/lifecycle')
const JobConstants = require('../../constants/jobs')
const TaskConstants = require('../../constants/task')

module.exports = {
  /**
   *
   * @param {Task} task
   * @param {Object} input
   * @property {User} input.user
   * @property {Customer} input.customer
   * @param {Function} next
   *
   */
  create (task, input, next) {
    next || (next = () => {})

    let argsDefinition = (
      task.task_arguments ||
      task.script_arguments
    )

    let inputArgsValues = (
      input.task_arguments_values ||
      input.script_arguments
    )

    App.taskManager.prepareTaskArgumentsValues(
      argsDefinition,
      inputArgsValues,
      (err, argsValues) => {
        if (err) { return next(err) }

        // delayed execution with grace time
        if (
          task.grace_time > 0 &&
          ( // automatic origin
            jobOrigin === JobConstants.ORIGIN_WORKFLOW ||
            jobOrigin === JobConstants.ORIGIN_TRIGGER_BY
          )
        ) {
          const runDate =  Date.now() + task.grace_time * 1000
          createScheduledJob({
            task,
            runDate,
            vars: input,
          }, next)
        } else {
          createJob({
            task,
            vars: input,
            argsValues
          }, next)
        }
      }
    )
  }
}

const createScheduledJob = (input, next) => {
  let { task, vars, runDate } = input
  let customer = vars.customer

  let data = {
    schedule: { runDate },
    task,
    customer,
    //event: vars.event._id,
    //event_data: vars.event_data,
    user: vars.user,
    origin: vars.origin,
    notify: true
  }

  App.scheduler.scheduleTask(data, (err, agenda) => {
    if (err) {
      logger.error('cannot schedule workflow job')
      logger.error(err)
      return next (err)
    }

    next (null, agenda)

    App.customer.getAlertEmails(customer.name, (err, emails) => {
      App.jobDispatcher.sendJobCancelationEmail({
        task_secret: task.secret,
        task_id: task.id,
        schedule_id: agenda.attrs._id,
        task_name: task.name,
        hostname: task.host.hostname,
        date: new Date(runDate).toISOString(),
        grace_time_mins: task.grace_time / 60,
        customer_name: customer.name,
        to: emails.join(',')
      })
    })
  })
}

/**
 *
 * @param {Object} input
 * @property {Object} input.vars
 * @property {Task} input.task
 * @property {Array} input.argsValues task arguments values
 *
 */
const createJob = (input, next) => {
  let { task, vars, argsValues } = input

  const setupJobBasicProperties = (job) => {
    if (task.workflow_id) {
      job.workflow = task.workflow_id
      job.workflow_id = task.workflow_id
      job.workflow_job = vars.workflow_job_id
      job.workflow_job_id = vars.workflow_job_id
    }

    // copy embedded task object
    job.task = Object.assign({}, task.toObject(), {
      customer: null,
      host: null
    }) // >>> add .id  / embedded

    job.task_id = task._id
    job.task_arguments_values = argsValues
    job.host_id = task.host_id;
    job.host = task.host_id;
    job.name = task.name;
    job.lifecycle = LifecycleConstants.READY
    job.customer_id = vars.customer._id;
    job.customer_name = vars.customer.name;
    job.user_id = vars.user._id
    job.user = vars.user._id
    job.notify = vars.notify;
    job.origin = vars.origin
    //job.event = vars.event || null
    //job.event_data = vars.event_data || {}
    //job.event_id = vars.event_id || null
    return job
  }

  const createScraperJob = (done) => {
    const job = new JobModels.Scraper()
    setupJobBasicProperties(job)
    return saveJob(job, done)
  }

  /**
   */
  const createScriptJob = (done) => {
    prepareScript(task.script_id, (err,script) => {
      if (err) { return done (err) }
      const job = new JobModels.Script()
      setupJobBasicProperties(job)
      job.script = script.toObject() // >>> add .id  / embedded
      job.script_id = script._id
      job.script_arguments = argsValues
      job.script_runas = task.script_runas
      /**
       * @todo should remove hereunder line in the future.
       * only keep for backward compatibility with agent versions number equal or older than version 0.11.3.
       * this is overwriting saved job.task.script_arguments definition.
       */
      job.task.script_arguments = argsValues
      return saveJob(job, done)
    })
  }

  /**
   * approval job is created onhold , waiting approver decision
   */
  const createApprovalJob = (done) => {
    const job = new JobModels.Approval()
    setupJobBasicProperties(job)
    job.lifecycle = LifecycleConstants.ONHOLD
    return saveJob(job, done)
  }

  const createDummyJob = (done) => {
    const job = new JobModels.Dummy()
    setupJobBasicProperties(job)
    return saveJob(job, done)
  }

  const saveJob = (job, done) => {
    job.save(err => {
      if (err) {
        logger.error('%o',err)
        return done(err)
      }
      done(null, job)
    })
  }

  switch (task.type) {
    case TaskConstants.TYPE_SCRIPT:
      createScriptJob(next);
      break;
    case TaskConstants.TYPE_SCRAPER:
      createScraperJob(next);
      break;
    case TaskConstants.TYPE_APPROVAL:
      createApprovalJob(next);
      break;
    case TaskConstants.TYPE_DUMMY:
      createDummyJob(next)
      break;
    default:
      const err = new Error(`invalid or undefined task type ${task.type}`)
      return next(err)
      break;
  }
}

const prepareScript = (script_id, next) =>  {
  const query = Script.findById(script_id)
  query.exec((err, script) => {
    if (err) {
      logger.error('%o',err)
      err.statusCode = 500
      return next(err)
    }

    if (!script) {
      let msg = 'cannot create job. script is no longer available'
      logger.error(msg)
      let err = new Error(msg)
      err.statusCode = 404
      return next(err)
    }

    next(null,script)
  })
}
