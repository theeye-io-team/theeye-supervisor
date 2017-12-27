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
exports.file  = {
  crud: 'file-crud'
}
exports.hostgroup = {
  crud: 'provisioning-crud'
}
exports.host = {
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
  cancelation: 'task-cancelation' // cancel job
}
exports.job = {
  crud: 'job-crud'
}
exports.webhook = {
  crud: 'webhook-crud',
  triggered: 'triggered-webhook'
}
exports.scheduler = {
  crud: 'scheduler-crud'
}
