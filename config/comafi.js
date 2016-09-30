/**
 * replace here the default configuration values for your
 * local development environment
 */
var join = require('path').join;
module.exports = {
  "is_dev": false,
  "system": {
    "base_url": "http://localhost:60080", //// Intranet supervisor URL here
    "web_url": "http://localhost:6080", //// docker web
    "file_upload_folder" : join(__dirname , '..', 'uploads')
  },
  "storage": {
    "driver": "local"
  },
  "monitor": {
    "fails_count_alert": 3,
    "agents_check_disconnected_interval_milliseconds": 20000,
    "resources_check_failure_interval_milliseconds": 10000,
    "resources_alert_failure_threshold_milliseconds": 30000
  },
  "mongo": {
    "user":"",
    "password":"",
    "hosts":"localhost:27017", ///// docker mongodb
    "database":"theeye-comafi"
  },
  "elasticsearch": {
    "enabled":true,
    "url":"http://localhost:9200", //// docker elastic search
    "db":"theeye_allcustomers"
  },
  "mailer": {
    "from": "The Eye %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
    "only_support": false,
    "include_support_bcc": false,
    "support": [],
    "transport": {
      "type":"sendmail"
    }
  }
}
