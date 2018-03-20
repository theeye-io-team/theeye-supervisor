const MonitorConstants = require('../../../constants/monitors');

module.exports = {
  dstat: {
    type: 'dstat',
    events:[{
      name: 'host:stats:cpu:high',
      message: function(resource, event_data) { return `${resource.hostname} cpu check failed. ${Number(event_data.cpu).toFixed(2)}% CPU in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} CPU alert`; }
    },{
      name: 'host:stats:mem:high',
      message: function(resource, event_data) { return `${resource.hostname} mem check failed. ${Number(event_data.mem).toFixed(2)}% MEM in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} MEM alert`; }
    },{
      name: 'host:stats:cache:high',
      message: function(resource, event_data) { return `${resource.hostname} cache check failed. ${Number(event_data.cache).toFixed(2)}% CACHE in use`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} CACHE alert`; }
    },{
      name: 'host:stats:disk:high',
      message: function(resource, event_data) { return `${resource.hostname} disks check failed.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} DISK alert`; }
    },{
      name:'host:stats:normal',
      message: function(resource, event_data) { return `${resource.hostname} stats recovered.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} STATS recovered`; }
    }]
  },
  psaux: { type: 'psaux', events: [] },
  host: {
    type: 'host',
    events: [{
      name: MonitorConstants.RESOURCE_STOPPED,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.hostname} unreachable`
      },
      message: function(resource, event_data) {
        return `Host ${resource.hostname.toUpperCase()} stopped reporting updates.`
      }
    },{
      name: MonitorConstants.RESOURCE_STARTED,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.hostname} recovered`
      },
      message: function(resource, event_data) {
        return `Host ${resource.hostname.toUpperCase()} started reporting again.`
      }
    }]
  },
  process: { type: 'process', events: [] },
  scraper: { type: 'scraper', events: [] },
  service: { type: 'service', events: [] },
  file: {
    type: 'file', 
    events: [{
      name: 'file:restored',
      message: function(resource, event_data) { return `${resource.hostname} file ${resource.monitor.config.path} stats has been changed or was not present in the filesystem. It was replaced with the saved version.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} file ${resource.monitor.config.basename} was restored`; }
    }]
  },
  script: {
    type: 'script',
    events: [
      {
        name: MonitorConstants.RESOURCE_FAILURE,
        subject: function(resource, event_data) {
          return `[${this.severity}] ${resource.name} failure`
        },
        message: function(resource, event_data) {
          // use an empty object if not set
          let result = (resource.last_event && resource.last_event.data) ? resource.last_event.data : {}

          const lastline = result.lastline ? result.lastline.trim() : ''
          const stdout = result.stdout ? result.stdout.trim() : ''
          const stderr = result.stderr ? result.stderr.trim() : ''
          const code = result.code

          let html = `<p>${resource.name} on ${resource.hostname} checks failed.</p>`

          if (!resource.last_event||!resource.last_event.data) return html

          html += `
            <span>Monitor output</span>
            <pre>
              <ul>
                <li>lastline : ${lastline}</li>
                <li>stdout : ${stdout}</li>
                <li>stderr : ${stderr}</li>
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
