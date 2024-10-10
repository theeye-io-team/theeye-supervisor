/**
 * replace here the default configuration values for your
 * local development environment
 */
const { join } = require('path')

module.exports = {
  storage: {
    driver: "local"
    //driver: "s3"
  },
  mongo: {
    uri: "mongodb://127.0.0.1/theeye?retryWrites=true&w=majority",
    options: {
      useFindAndModify: false,
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
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
  authentication: {
    // same key must be in every internal service
    //rs256: {
    //  pub: join(__dirname, 'jwtRS256.key.pub'),
    //  priv: join(__dirname, 'jwtRS256.key')
    //},
    secret: '2c1000c295ae613b031d3466db34ef021a5ae064',
    expiresIn: 10,
    protocol: 'http', // http or https
    api: {
      timeout: 5000,
      host: 'localhost',
      port: '8080',
      path: {
        verify: '/api/session/verify',
        profile: '/api/session/profile',
        login: '/api/auth/login/local'
      }
    }
  },
  gateway: {
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
  },
  marketplace: {
    enabled: true,
    customer_id: '6328bcd0276ebdc8ccb87d49'
  }
}
