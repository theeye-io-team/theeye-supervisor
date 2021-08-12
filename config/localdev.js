/**
 * replace here the default configuration values for your
 * local development environment
 */
module.exports = {
  storage: {
    driver: "local"
  },
  mongo: {
    uri: "mongodb://127.0.0.1/theeye?retryWrites=true&w=majority"
  },
  monitor: {
    fails_count_alert: 1
  },
  mailer: {
    from: '%customer% TheEye.io Dev <support@theeye.io>',
    replyTo: 'Support <support@theeye.io>',
    only_support: false,
    include_support_bcc: false,
    support: ['facugon@theeye.io'],
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
  notifications: {
    api: {
      //url: 'http://127.0.0.1:6080/api/notification' // the same web server
      url: 'http://localhost:8080/api/notification' // gateway
    }
  },
  gateway: {
    secret: '77E0EAF3B83DD7A7A4004602626446EADED31BF794956FC9BBAD051FA5A25038',
    member: {
      url: 'http://localhost:8080/api/internal/member/resolve'
    },
    user: {
      url: 'http://localhost:8080/api/internal/user/resolve'
    }
  },
  integrations: {
    aws: {
      enabled: false,
      config: {
        //"username": "",
        //"accessKeyId": "",
        //"secretAccessKey": "",
        //"region": ""
      },
      s3: {
        bucket: "theeye.dev"
      }
    }
  }
}
