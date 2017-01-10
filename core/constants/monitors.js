"use strict";

module.exports = Object.freeze({
  SUCCESS_STATES: [
    'success',
    'ok',
    'normal'
  ],
  FAILURE_STATES: [
    'error',
    'fail',
    'failure'
  ],
  RESOURCE_FAILURE: 'failure',
  RESOURCE_NORMAL: 'normal',
  RESOURCE_STOPPED: 'updates_stopped',
  RESOURCE_RECOVERED: 'recovered',
  AGENT_STOPPED: 'agent_stopped',
  RESOURCE_TYPE_DEFAULT: 'unknown',
  RESOURCE_TYPE_DSTAT: 'dstat',
  RESOURCE_TYPE_PSAUX: 'psaux',
  RESOURCE_TYPE_SCRIPT: 'script',
  RESOURCE_TYPE_PROCESS: 'process',
  RESOURCE_TYPE_SCRAPER: 'scraper',
  MONITOR_SEVERITY_LOW: 'LOW',
  MONITOR_SEVERITY_HIGH: 'HIGH',
  MONITOR_SEVERITY_CRITICAL: 'CRITICAL',
  get MONITOR_SEVERITIES () {
    return [
      this.MONITOR_SEVERITY_LOW,
      this.MONITOR_SEVERITY_HIGH,
      this.MONITOR_SEVERITY_CRITICAL
    ];
  }
});
