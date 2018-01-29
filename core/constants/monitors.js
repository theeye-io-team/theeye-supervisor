'use strict'

module.exports = Object.freeze({
  DEFAULT_HEALTH_THRESHOLD_CPU: 80,
  DEFAULT_HEALTH_THRESHOLD_MEM: 85,
  DEFAULT_HEALTH_THRESHOLD_CACHE: 85,
  DEFAULT_HEALTH_THRESHOLD_DISK: 90,
  SUCCESS_STATES: ['success', 'ok', 'normal'],
  FAILURE_STATES: ['error', 'fail', 'failure'],
  // MONITOR STATES
  RESOURCE_FAILURE: 'failure',
  RESOURCE_NORMAL: 'normal',
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
  MONITOR_SEVERITY_LOW: 'LOW',
  MONITOR_SEVERITY_HIGH: 'HIGH',
  MONITOR_SEVERITY_CRITICAL: 'CRITICAL',
  get MONITOR_STATES () {
    return [
      this.RESOURCE_FAILURE,
      this.RESOURCE_NORMAL,
      this.RESOURCE_STOPPED,
      this.RESOURCE_CHANGED,
      this.RESOURCE_ERROR,
      this.AGENT_STOPPED
    ]
  },
  get MONITOR_SEVERITIES () {
    return [
      this.MONITOR_SEVERITY_LOW,
      this.MONITOR_SEVERITY_HIGH,
      this.MONITOR_SEVERITY_CRITICAL
    ]
  }
})
