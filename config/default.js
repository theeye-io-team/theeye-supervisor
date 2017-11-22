module.exports = {
  "is_dev": false,
  "server": {
    "name": "TheEye",
    "version": process.env.VERSION || undefined,
    "port": process.env.PORT || 60080,
    "auth_strategy": "bearer"
  },
  "system": {
    "base_url": "",
    "web_url": "",
    "view_teamplates_path": __dirname + "/../core/view/template",
    "file_upload_folder": "/tmp",
    "secret": "b28d9f2a4d52ace6e5d3ac1dd3e5c2a0e7e66472ec7276ca501b8c4fa1f07679",
    "user": {
      "username": "theeye-automatic",
      "email": "info@theeye.io",
      "enabled": true,
      "client_id": null,
      "client_secret": null,
      "token": null
    }
  },
  "storage": {
    "driver": "s3" // local or s3
  },
  "s3": {
    "bucket":"theeye.scripts"
  },
  "mongo":{
  /**
    "options":{ // passed directly to the mongo-native driver
      "replset": {
        "socketOptions": {
          "keepAlive": 30*1000,
          "connectTimeoutMS": 60*1000,
          "socketTimeoutMS": 60*1000
        }
      }
    },
    "user":"",
    "password":"",
    "hosts": "localhost:27017",
    "database": "theeye"
  */
  },
  "monitor": {
    "disabled": false,
    "fails_count_alert": 3,
    "check_interval": 10000
  },
  "agent": {
    "core_workers": {
      "host_ping": {
        "type":"keepAlive",
        "looptime":30000
      }
    }
  },
  /** aws sns, s3, ses **/
  "aws": {
    "username":"",
    "accessKeyId": "",
    "secretAccessKey": "",
    "region": ""
  },
  "mailer": {
    "from": "The Eye %customer% <%customer%@theeye.io>",
    "reply_to": "Info <info@theeye.io>",
    "only_support": false,
    "include_support_bcc": false,
    "support": [],
    "transport": {
      /** 
       * use aws email service 
       * more options
       * https://github.com/andris9/nodemailer-ses-transport
       *
       **/
      "type":"ses",
      /**
      "options":{
        "accessKeyId":"",
        "secretAccessKey":"",
        "sessionToken":"",
        "region":"",
        "httpOptions":"",
        "rateLimit":"",
      }
      */
      /**
       * use local sendmail smtp , with no options
       * "type":"sendmail",
       *
       * or smtp
       * more options
       * https://github.com/nodemailer/nodemailer-smtp-transport
       *
       * "type":"smtp",
       * "options":{
       *   "port":"",
       *   "host":"",
       *   "secure":"",
       *   "auth":"",
       *   "ignoreTLS":"",
       *   "name":"",
       *   "localAddress":"",
       *   "connectionTimeout":"",
       *   "greetingTimeout":"",
       *   "socketTimeout":"",
       *   "logger":"",
       *   "debug":"",
       *   "authMethod":"",
       *   "tls":"",
       * }
       */
    }
  },
  "sns": {
    "topicArn": {
      "events": "",
      "host-stats": "",
      "jobs": ""
    }
  },
  // direct [ supervisor > web ] notifications - no AWS-SNS endpoints
  "web-sns":{
    "topicEndpoint": {
      "events": "/events/update",
      "host-stats": "/hoststats/update",
      "jobs": "/palanca/update"
    }
  },
  "elasticsearch": {
    "enabled": false,
    "url": "",
  },
  "notifications": {
    "topics": {
      "agent": {
        "version": "agent-version"
      },
      "host": {
        "stats": "host-stats",
      },
      //"resource": {
      //  "stats": "resource-stats",
      //},
      "monitor": {
        "crud": "monitor-crud",
        "execution": "monitor-execution",
        "state": "monitor-state",
      },
      "script": {
        "crud": "script-crud"
      },
      "file": {
        "crud": "file-crud"
      },
      "hostgroup": {
        "crud": "provisioning-crud",
      },
      "host": {
        "crud": "host-crud",
        "stats": "host-stats"
      },
      "task": {
        "crud": "task-crud",
        "execution": "task-execution",
        "result": "task-result"
      },
      "job": {
        "crud": "job-crud"
      },
      "webhook": {
        "crud": "webhook-crud",
        "triggered": "triggered-webhook"
      },
      "scheduler": {
        "crud": "scheduler-crud"
      }
    }
  },
  "events": {
  }
}
