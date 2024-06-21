const Monitor = exports.monitor = {
  crud: 'monitor-crud',
  execution: 'monitor-execution',
  state: 'monitor-state'
}

const Indicator = exports.indicator = {
  crud: 'indicator-crud',
  state: 'indicator-state'
}

exports.script = {
  crud: 'script-crud'
}
exports.agent = {
  version: 'agent-version'
}
const File = exports.file = {
  crud: 'file-crud'
}
exports.hostgroup = {
  crud: 'provisioning-crud'
}

exports.host = {
  integrations: {
    crud: 'host-integrations-crud'
  },
  crud: 'host-crud',
  state: 'host-state',
  processes: 'host-processes',
  stats: 'host-stats',
  registered: 'host-registered'
}

exports.task = {
  crud: 'task-crud',
  //execution: 'task-execution', // create/start job
  hold: 'task-hold-execution', // create holded task execution
  assigned: 'task-assigned', // assigned to agent
  result: 'task-result', // job result updated
  cancelation: 'task-cancelation', // job canceled
  terminate: 'task-terminate', // job terminate
  notification: 'notification-task'
}

const Workflow = exports.workflow = {
  //crud: 'workflow-crud',
  job: {
    crud: 'workflow-job-crud',
    finished: 'workflow-job-finished' // workflow job completed, no more tasks to execute
  },
  //execution: 'workflow-execution',
}

const Job = exports.job = {
  crud: 'job-crud',
  finished: 'job-finished'
}

exports.schedule = {
  crud: 'schedule-crud'
}

const Webhook = exports.webhook = {
  crud: 'webhook-crud',
  triggered: 'webhook-triggered'
}

exports.triggers = [
  Job.finished,
  Webhook.triggered,
  Workflow.job.finished,
  File.crud,
  Indicator.crud,
  Indicator.state,
  Monitor.state,
]
