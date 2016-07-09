/**
 * replace here the default configuration values for your
 * local development environment
 */
var join = require('path').join;
module.exports = {
  "is_dev": true,
  "storage": {
    "driver": "local"
  },
  "system": {
    "base_url": "http://theeye-supervisor:60080",
    "web_url": "http://theeye-web:6080",
    "file_upload_folder" : join(__dirname , '..', 'uploads')
  },
  "mongo": {
    "hosts": "theeye-db",
    "database": "theeye",
    "port": "27017",
    "user": "",
    "password": "",
    "options": {}
  },
  "mailer": {
    "from": "The Eye Development %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
    "only_support": true,
    "include_support_bcc": true,
    "support": [ "support@theeye.io" ],
    "transport": {
      "type":"sendmail"
    }
  }
}
