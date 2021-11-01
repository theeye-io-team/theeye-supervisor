exports.monitor = {
  crud: 'monitor-crud',
  execution: 'monitor-execution',
  state: 'monitor-state'
}
exports.indicator = {
  crud: 'indicator-crud',
  state: 'indicator-state'
}
exports.script = {
  crud: 'script-crud'
}
exports.agent = {
  version: 'agent-version'
}
exports.file = {
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
  execution: 'task-execution', // create/start job
  hold: 'task-hold-execution', // create holded task execution
  assigned: 'task-assigned', // assigned to agent
  result: 'task-result', // job result updated
  cancelation: 'task-cancelation', // job canceled
  terminate: 'task-terminate', // job terminate
  notification: 'notification-task'
}

exports.workflow = {
  execution: 'workflow-execution'
}

exports.job = {
  crud: 'job-crud',
  finished: 'job-finished'
}

exports.schedule = {
  crud: 'schedule-crud'
}

exports.webhook = {
  crud: 'webhook-crud',
  triggered: 'webhook-triggered'
}
