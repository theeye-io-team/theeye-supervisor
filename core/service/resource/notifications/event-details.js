const MonitorConstants = require('../../../constants/monitors');

const CPU_ALERT = 'host:stats:cpu:high'
const MEM_ALERT = 'host:stats:mem:high'
const CACHE_ALERT = 'host:stats:cache:high'
const DISK_ALERT = 'host:stats:disk:high'
const STATS_NORMAL = 'host:stats:normal'

module.exports = {
  dstat: {
    type: MonitorConstants.RESOURCE_TYPE_DSTAT,
    events: [{
      name: MonitorConstants.RESOURCE_FAILURE,
      message: function (resource, event_data) {
        let msg
        switch (event_data.custom_event) {
          case CPU_ALERT:
            msg = `${resource.hostname} cpu check failed. ${Number(event_data.data.cpu).toFixed(2)}% CPU in use`
            break;
          case MEM_ALERT:
            msg = `${resource.hostname} mem check failed. ${Number(event_data.data.mem).toFixed(2)}% MEM in use`
            break;
          case CACHE_ALERT:
            msg = `${resource.hostname} cache check failed. ${Number(event_data.data.cache).toFixed(2)}% CACHE in use`
            break;
          case DISK_ALERT:
            msg = `${resource.hostname} disks check failed.`
            break;
        }
        return msg
      },
      subject: function (resource, event_data) {
        let subj
        switch (event_data.custom_event) {
          case CPU_ALERT:
            subj = `[${this.severity}] ${resource.hostname} CPU alert`
            break;
          case MEM_ALERT:
            subj = `[${this.severity}] ${resource.hostname} MEM alert`
            break;
          case CACHE_ALERT:
            subj = `[${this.severity}] ${resource.hostname} CACHE alert`
            break;
          case DISK_ALERT:
            subj = `[${this.severity}] ${resource.hostname} DISK alert`
            break;
        }
        return subj
      }
    },{
      name: MonitorConstants.RESOURCE_RECOVERED,
      message: function (resource, event_data) {
        msg = `${resource.hostname} stats recovered.`
        return msg
      },
      subject: function (resource, event_data) {
        subj = `[${this.severity}] ${resource.hostname} STATS recovered`
        return subj
      }
    }]
  },
  psaux: { type: MonitorConstants.RESOURCE_TYPE_PSAUX, events: [] },
  host: {
    type: MonitorConstants.RESOURCE_TYPE_HOST,
    events: [{
      name: MonitorConstants.RESOURCE_STOPPED,
      subject: function(resource) {
        return `[${this.severity}] ${resource.hostname} unreachable`
      },
      message: function(resource) {
        return `Host ${resource.hostname.toUpperCase()} stopped reporting updates.`
      }
    },{
      name: MonitorConstants.RESOURCE_STARTED,
      subject: function(resource) {
        return `[${this.severity}] ${resource.hostname} recovered`
      },
      message: function(resource) {
        return `Host ${resource.hostname.toUpperCase()} started reporting again.`
      }
    }]
  },
  process: { type: MonitorConstants.RESOURCE_TYPE_PROCESS, events: [] },
  scraper: { type: MonitorConstants.RESOURCE_TYPE_SCRAPER, events: [] },
  nested: { type: MonitorConstants.RESOURCE_TYPE_NESTED, events: [] },
  file: {
    type: MonitorConstants.RESOURCE_TYPE_FILE, 
    events: [{
      name: MonitorConstants.RESOURCE_CHANGED,
      message: function(resource) { return `${resource.hostname} file ${resource.monitor.config.path} stats has been changed or was not present in the filesystem. It was replaced with the saved version.`; },
      subject: function(resource) { return `[${this.severity}] ${resource.hostname} file ${resource.monitor.config.basename} was restored`; }
    }]
  },
  script: {
    type: 'script',
    events: [
      {
        name: MonitorConstants.RESOURCE_FAILURE,
        subject: function(resource) {
          return `[${this.severity}] ${resource.name} failure`
        },
        message: function(resource) {
          // use an empty object if not set
          let result = (resource.last_event && resource.last_event.data) ? resource.last_event.data : {}

          const lastline = result.lastline ? result.lastline.trim() : ''
          const log = result.log ? result.log.trim() : ''
          const code = result.code

          let html = `<p>${resource.name} on ${resource.hostname} checks failed.</p>`

          if (!resource.last_event||!resource.last_event.data) return html

          html += `
            <span>Monitor output</span>
            <pre>
              <ul>
                <li>full log : ${log}</li>
                <li>lastline : ${lastline}</li>
                <li>code : ${code}</li>
              </ul>
            </pre>
            `

          return html
        }
      }
    ]
  },
}
