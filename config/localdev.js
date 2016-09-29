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
    "fails_count_alert": 3,
    "agents_check_disconnected_interval_milliseconds": 20000,
    "resources_check_failure_interval_milliseconds": 10000,
    "resources_alert_failure_threshold_milliseconds": 30000
  },
  "mongo": {
    "user": "",
    "password": "",
    "hosts": "localhost:27017",
    "database": "theeye"
  },
  "elasticsearch": {
    "enabled":true,
    "url":"http://localhost:9200", // via ssh tunnel
    "db":"theeye_allcustomers"
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
/**
  mailer: {
    from: "The Eye Development %customer% <%customer%@theeye.io>",
    reply_to: "Support <support@theeye.io>",
    only_support: true,
    include_support_bcc: false,
    support: ["facugon@interactar.com"],
    transport: {
      //"type":"sendmail"
      type:"smtp",
      service:"gmail",
			auth: {
				XOAuth2: {
					user: "facundo.siquot@gmail.com", // Your gmail address.
					clientId : "714923395260-9jd45ige6gg86mffrvf419dvuh85360t.apps.googleusercontent.com",
					clientSecret : "k6eNjkeiRriseEUgPBWlGiHr",
					refreshToken: "1/V8cfViH1Qaw9dOWi3eX-YbzmEjzaUyQ6zch6Wo7mq0A"
				}
			}
    }
  }
*/
}
