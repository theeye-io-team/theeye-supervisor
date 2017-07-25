/**
 * replace here the default configuration values for your
 * local development environment
 */
var join = require('path').join;
module.exports = {
  "is_dev": true,
  "system": {
    "base_url": "http://localhost:60080",
    "web_url": "http://localhost:6080",
    "file_upload_folder" : join(__dirname , '..', 'uploads')
  },
  "storage": {
    "driver": "local"
  },
  "monitor": {
    "disabled": false, // this is enabled if not specified or by default
    "fails_count_alert": 3,
    "resources_check_failure_interval_milliseconds": 10000,
    "resources_alert_failure_threshold_milliseconds": 30000
  },
  "mongo": {
    "debug":false,
    "user": "",
    "password": "",
    "hosts": "localhost:27017",
    "database": "theeye"
  },
  "elasticsearch": {
    "enabled": false,
    "url":"http://localhost:9200", // via ssh tunnel
    "keys":{
      //"prefix":"localdev-"
    }
  },
  "mailer": {
    "from": "The Eye Development %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
    "only_support": false,
    "include_support_bcc": false,
    "support": [],
    "transport": {
      "type":"sendmail"
    }
  }
}
