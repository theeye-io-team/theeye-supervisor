'use strict'

module.exports = Object.freeze({
  DEFAULT_HEALTH_THRESHOLD_CPU: 90,
  DEFAULT_HEALTH_THRESHOLD_MEM: 90,
  DEFAULT_HEALTH_THRESHOLD_CACHE: 90,
  DEFAULT_HEALTH_THRESHOLD_DISK: 90,
  DEFAULT_LOOPTIME: 60000, // 1 minute
  SUCCESS_STATES: ['success', 'ok', 'normal'],
  FAILURE_STATES: ['error', 'fail', 'failure'],
  // MONITOR STATES
  RESOURCE_FAILURE: 'failure',
  RESOURCE_NORMAL: 'normal',
  RESOURCE_SUCCESS: 'success',
  RESOURCE_RECOVERED: 'recovered',
  RESOURCE_STOPPED: 'updates_stopped',
  RESOURCE_STARTED: 'updates_started',
  RESOURCE_CHANGED: 'changed',
  RESOURCE_ERROR: 'error',
  AGENT_STOPPED: 'agent_stopped',
  // MONITOR STATES END
  WORKERS_ERROR_EVENT: 'agent:worker:error',
  RESOURCE_TYPE_DEFAULT: 'unknown',
  RESOURCE_TYPE_HOST: 'host',
  RESOURCE_TYPE_DSTAT: 'dstat',
  RESOURCE_TYPE_PSAUX: 'psaux',
  RESOURCE_TYPE_SCRIPT: 'script',
  RESOURCE_TYPE_PROCESS: 'process',
  RESOURCE_TYPE_SCRAPER: 'scraper',
  RESOURCE_TYPE_FILE: 'file',
  RESOURCE_TYPE_NESTED: 'nested',
  MONITOR_SEVERITY_LOW: 'LOW',
  MONITOR_SEVERITY_HIGH: 'HIGH',
  MONITOR_SEVERITY_CRITICAL: 'CRITICAL',
  get MONITOR_STATES () {
    return [
      this.RESOURCE_NORMAL,
      this.RESOURCE_CHANGED,
      this.RESOURCE_FAILURE,
      this.RESOURCE_STOPPED,
      this.AGENT_STOPPED,
      this.RESOURCE_ERROR,
    ]
  },
  //
  // STATES SORT ORDER
  //
  // Monitors can be in only one of the following states at the time.
  //
  // normal, failure, updates_stopped.
  //
  // Can change from one state to another
  //
  get MONITOR_STATES_ORDER () {
    return [
      this.RESOURCE_STOPPED,
      this.RESOURCE_FAILURE,
      this.RESOURCE_NORMAL
    ]
  },
  get MONITOR_SEVERITIES () {
    return [
      this.MONITOR_SEVERITY_CRITICAL,
      this.MONITOR_SEVERITY_HIGH,
      this.MONITOR_SEVERITY_LOW
    ]
  }
})
