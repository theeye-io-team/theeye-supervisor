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
    "base_url": "http://localhost:60080",
    "web_url": "http://localhost:6080",
    "file_upload_folder" : join(__dirname + '/', 'uploads')
  },
  "mongo": {
    "user": "",
    "password": "",
    "hosts": "localhost:27017",
    "database": "theeye"
  },
  "elasticsearch": {
    "enabled":true,
    "url":"http://localhost:9200",
    "db":"theeye_allcustomers",
  },
  "mailer": {
    "from": "The Eye Development %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
    "only_support": false,
    "include_support_bcc": false,
    "support": [ "support@theeye.io" ],
    "transport": {
      "type":"sendmail"
    }
  }
}
