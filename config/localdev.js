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
    from: "The Eye Development %customer% <%customer%@theeye.io>"
  },
  notifications: {
    api: {
      url: 'http://127.0.0.1:6080/api/notification' // the same web server
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
