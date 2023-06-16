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
  mailer: {
    from: '%customer% TheEye.io Dev <support@theeye.io>',
    replyTo: 'Support <support@theeye.io>',
    only_support: false,
    include_support_bcc: false,
    support: [],
    invitation: 'contact@theeye.io',
    transport: {
      type: 'smtp',
      // options are passed directly to nodemailer transport contructor
      options: {
        port: 6025,
        secure: false,
        //tls: {
        //  // do not fail on invalid certs
        //  rejectUnauthorized: false
        //},
        ignoreTLS: true
      }
    }
  },
  authentication: {
    rs256: {
      pub: join(__dirname, 'jwtRS256.key.pub'),
      priv: join(__dirname, 'jwtRS256.key')
    },
    secret: '692fc164a0c06a9fd02575cf17688c9e'
  },
  monitor: {
    disabled: true,
    fails_count_alert: 3,
    check_interval: 10000
  }
}
