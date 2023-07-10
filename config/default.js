const join = require('path').join

module.exports = {
  server: {
    name: 'TheEye Core',
    version: process.env.APP_VERSION || undefined,
    port: process.env.PORT || 60080
  },
  system: {
    base_url: 'http://127.0.0.1:60080',
    web_url: 'http://127.0.0.1:6080',
    file_upload_folder: join(__dirname , '..', 'uploads'),
    secret: 'b28d9f2a4d52ace6e5d3ac1dd3e5c2a0e7e66472ec7276ca501b8c4fa1f07679',
    secret_uuid: 'a2a29a19-aba1-412b-a9ba-c29668e3c17b',
    logs: `${__dirname}/../logs`,
    user: {
      username: 'theeye-automatic',
      email: 'info@theeye.io',
      enabled: true,
      client_id: null,
      client_secret: null,
      token: null
    }
  },
  /**
   *
   * storage driver local or s3
   *
   */
  storage: {
    driver: 's3'
  },
  /**
   *
   * mongo database configuration
   *
   * 'user':'',
   * 'password':'',
   * 'hosts': 'localhost:27017',
   * 'database': 'theeye',
   * 'replicaSet': 'replica_set_name' // >> will concat '?replicaSet='replica_set_name'' to the end of the connection string
   * // options are passed directly to the mongo-native driver
   * 'options': {
   *   'replset': {
   *     'socketOptions': {
   *       'keepAlive': 30*1000,
   *       'connectTimeoutMS': 60*1000,
   *       'socketTimeoutMS': 60*1000
   *     }
   *   }
   * },
   *
   */
  mongo: {
    debug: false,
    user: '',
    password: '',
    hosts: '127.0.0.1:27017',
    database: 'theeye',
    // sample uri
    // uri: mongodb+srv://<user>:<password>@<host>/<db>?retryWrites=true&w=majority
    // options are passed directly to the mongo-native driver
    options: {
      useFindAndModify: false,
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  /**
   *
   * monitoring service configuration
   *
   */
  monitor: {
    fails_count_alert: 3,
    disabled: false,
    check_interval: 10000
  },
  agent: {
    core_workers: {
      host_ping: {
        type: 'keepAlive',
        looptime: 30000
      }
    }
  },
  /**
   *
   * nodemailer configuration
   * aws ses options:
   * https://github.com/andris9/nodemailer-ses-transport
   *
   * sendmail:
   * https://github.com/nodemailer/nodemailer-smtp-transport
   *
   */
  mailer: {
    from: '%customer% TheEye.io <support@theeye.io>',
    reply_to: 'Support <support@theeye.io>',
    only_support: false,
    include_support_bcc: false,
    support: [ 'facugon@theeye.io' ],
    transport: {
      type: 'sendmail',
      options: { }
    }
  },
  logger: {
    dump: {
      enabled: false,
      filename: '/tmp/logger.log'
    },
    remote: {
      timeout: 5000,
      enabled: true
    },
    /**
     *
     * elastic search global settings for all organization
     *
     */
    elasticsearch: {
      timeout: 5000,
      enabled: true
    }
  },
  scheduler: {
    enabled: true // enabled-disable jobs scheduler. will not listen to job events
  },
  /**
   *
   * notifications api configuration.
   * micro service required to send internal notification
   *
   */
  notifications: {
    api: {
      url: process.env.CONFIG_NOTIFICATIONS_API_URL || 'http://127.0.0.1:6080/api/notification',
      timeout: 5000
    }
  },
  authentication: {
    protocol: 'http',
    api: {
      timeout: 5000,
      host: '127.0.0.1',
      port: '6080',
      path: {
        verify: '/api/session/verify',
        profile: '/api/session/profile',
        login: '/api/auth/login/local'
      }
    },
    rs256: {
      pub: null,
      priv: null
    },
    secret: '692fc164a0c06a9fd02575cf17688c9e'
  },
  gateway: {
    member: {
      url: process.env.CONFIG_MEMBER_API_URL || 'http://127.0.0.1:6080/api/internal/member/resolve'
    },
    user: {
      url: process.env.CONFIG_USER_API_URL || 'http://127.0.0.1:6080/api/internal/user/resolve'
    }
  },
  /**
   *
   * integration configurations
   *
   */
  integrations: {
    /** aws sns, s3, ses **/
    aws: {
      enabled: true,
      config: {
        username: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: ''
      },
      s3: {
        bucket: 'theeye.scripts'
      }
    }
  },
  marketplace: {
    enabled: true,
    customer_id: '6328bcd0276ebdc8ccb87d49'
  },
  redis: {
    //url: 'redis[s]://[[username][:password]@][host][:port][/db-number]'
    url: 'redis://127.0.0.1:6379/3'
  }

}
