exports.monitor = {
  crud: 'monitor-crud',
  execution: 'monitor-execution',
  state: 'monitor-state'
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
  sent: 'task-sent', // sent to agent
  result: 'task-result', // update/finalize job
  cancelation: 'task-cancelation', // cancel job
  terminate: 'task-terminate', // terminate a job
}
exports.workflow = {
  execution: 'workflow-execution'
}
exports.job = {
  crud: 'job-crud',
  //onhold: 'job-onhold'
}
exports.webhook = {
  crud: 'webhook-crud',
  triggered: 'webhook-triggered'
}
exports.scheduler = {
  crud: 'scheduler-crud'
}
