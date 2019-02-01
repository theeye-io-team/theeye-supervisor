/**
 * replace here the default configuration values for your
 * local development environment
 */
var join = require('path').join;
module.exports = {
  "system": {
    "base_url": "http://127.0.0.1:60080",
    "web_url": "http://127.0.0.1:6080",
    "file_upload_folder" : join(__dirname , '..', 'uploads')
  },
  "monitor": {
    "disabled": false, // this is enabled if not specified or by default
    "fails_count_alert": 1,
    "resources_check_failure_interval_milliseconds": 10000,
    "resources_alert_failure_threshold_milliseconds": 30000
  },
  "mongo": {
    "debug":false,
    "user": "",
    "password": "",
    "hosts": "127.0.0.1:27017",
    "database": "theeye"
  },
  "elasticsearch": {
    "enabled": true
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
  },
  "notifications": {
    "api": {
      "secret": 'secret_passphrase',
      "url": "http://127.0.0.1:6080/notification" // the same web server
    }
  },
  "storage": {
    "driver": "local"
  },
  "integrations": {
    "aws": {
      "enabled": false,
      "config": {
        //"username": "",
        //"accessKeyId": "",
        //"secretAccessKey": "",
        //"region": ""
      },
      "s3": {
        "bucket":"theeye.dev"
      }
    }
  }
}
