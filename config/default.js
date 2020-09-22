const join = require('path').join

module.exports = {
  server: {
    name: "TheEye Core",
    version: process.env.VERSION || undefined,
    port: process.env.PORT || 60080
  },
  system: {
    base_url: "http://127.0.0.1:60080",
    web_url: "http://127.0.0.1:6080",
    file_upload_folder: join(__dirname , '..', 'uploads'),
    view_teamplates_path: __dirname + "/../core/view/template",
    secret: "b28d9f2a4d52ace6e5d3ac1dd3e5c2a0e7e66472ec7276ca501b8c4fa1f07679",
    user: {
      username: "theeye-automatic",
      email: "info@theeye.io",
      enabled: true,
      client_id: null,
      client_secret: null,
      token: null
    }
  },
  agent: {
    core_workers: {
      host_ping: {
        type: "keepAlive",
        looptime: 30000
      }
    }
  },
  /**
   *
   * storage driver local or s3
   *
   */
  storage: {
    driver: "s3"
  },
  /**
   *
   * mongo database configuration
   *
   * "user":"",
   * "password":"",
   * "hosts": "localhost:27017",
   * "database": "theeye",
   * "replicaSet": "replica_set_name" // >> will concat '?replicaSet="replica_set_name"' to the end of the connection string
   * // options are passed directly to the mongo-native driver
   * "options": {
   *   "replset": {
   *     "socketOptions": {
   *       "keepAlive": 30*1000,
   *       "connectTimeoutMS": 60*1000,
   *       "socketTimeoutMS": 60*1000
   *     }
   *   }
   * },
   *
   */
  mongo: {
    debug: false,
    user: "",
    password: "",
    hosts: "127.0.0.1:27017",
    database: "theeye",
    // sample uri
    // uri: mongodb+srv://<user>:<password>@<host>/<db>?retryWrites=true&w=majority
    // options are passed directly to the mongo-native driver
    options: {
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
    disabled: false,
    fails_count_alert: 3,
    check_interval: 10000
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
    from: "The Eye %customer% <%customer%@theeye.io>",
    reply_to: "Info <info@theeye.io>",
    only_support: false,
    include_support_bcc: false,
    support: [ "facugon@theeye.io" ],
    transport: {
      type: "sendmail",
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
      // outgoing requests secret passphrase
      secret: '77E0EAF3B83DD7A7A4004602626446EADED31BF794956FC9BBAD051FA5A25038',
      timeout: 5000,
      url: process.env.CONFIG_NOTIFICATIONS_API_URL || "http://127.0.0.1:6080/api/notification"
    }
  },
  authentication: {
    // same key must be in every internal service
    secret: '692fc164a0c06a9fd02575cf17688c9e',
    protocol: 'http', // http or https
    api: {
      timeout: 5000,
      host: '127.0.0.1',
      port: '6080'
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
        username: "",
        accessKeyId: "",
        secretAccessKey: "",
        region: ""
      },
      s3: {
        bucket: "theeye.scripts"
      }
    }
  }
}
