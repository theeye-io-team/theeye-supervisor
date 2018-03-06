const Constants = require('../../../constants/monitors');

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
      name: Constants.RESOURCE_STOPPED,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.hostname} unreachable`
      },
      message: function(resource, event_data) {
        return `Host ${resource.hostname.toUpperCase()} stopped reporting updates.`
      }
    },{
      name: Constants.RESOURCE_RECOVERED,
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
  script: {
    type: 'script',
    events: [{
      name: Constants.RESOURCE_FAILURE,
      subject: function(resource, event_data) {
        return `[${this.severity}] ${resource.name} failure`
      },
      message: function(resource, event_data) {
        // use an empty object if not set
        let result = (resource.last_event && resource.last_event.data) ? resource.last_event.data : {}

        const lastline = result.lastline ? result.lastline.trim() : 'no data'
        const stdout = result.stdout ? result.stdout.trim() : 'no data'
        const stderr = result.stderr ? result.stderr.trim() : 'no data'
        const code = result.code || 'no data'

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
    }]
  },
  file: {
    type: 'file', 
    events: [{
      name: 'monitor:file:changed',
      message: function(resource, event_data) { return `${resource.hostname} file ${resource.monitor.config.path} stats has been changed or was not present in the filesystem. It was replaced with the saved version.`; },
      subject: function(resource, event_data) { return `[${this.severity}] ${resource.hostname} file ${resource.monitor.config.basename} was restored`; }
    }]
  },
}
