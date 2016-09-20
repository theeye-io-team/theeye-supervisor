module.exports = {
  "is_dev": false ,
  "storage": {
    "driver": "s3" // local or s3
  },
  "system": {
    "base_url": "",
    "web_url": "",
    "view_teamplates_path": __dirname + "/../core/view/template",
    "file_upload_folder": "/tmp"
  },
  "monitor": {
    /* cantidad de fallas antes de emitir alertas */
    "fails_count_alert": 3,
    /* cada cuanto tiempo chequear estado */
    "agents_check_disconnected_interval_milliseconds": 20000,
    /* cada cuanto tiempo chequear estado */
    "resources_check_failure_interval_milliseconds": 10000,
    /* despues de cuantos milisegundos de no actualizar estado entra en alerta */
    "resources_alert_failure_threshold_milliseconds": 30000
  },
  "agent": {
    "core_workers": {
      "host_ping": {
        "looptime":30000,
        "type":"keepAlive"
      }
    }
  },
  /** aws sns, s3, ses **/
  "aws": {
    "username":"",
    "accessKeyId": "",
    "secretAccessKey": "",
    "region": "",
  },
  "s3": {
    "bucket":"theeye.scripts"
  },
  "sns": {
    "topicArn": {
      "events": "",
      "host-stats": "",
      "jobs": ""
    }
  },
  "mailer": {
    "from": "The Eye %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
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
  // development no AWS-SNS endpoints
  "web-sns":{
    "topicEndpoint": {
      "events": "/events/update",
      "host-stats": "/hoststats/update",
      "jobs": "/palanca/update"
    }
  },
  "elasticsearch": {
    "enabled":false,
    "url":"",
    "db":"",
    "keys":{
      "agent":{
        "version":"agent-version"
      },
      "host":{
        "stats":"host-stats",
      },
      "resource":{
        "stats":"resource-stats",
      },
      "monitor":{
        "crud":"crud-monitor"
      },
      "script":{
        "crud":"crud-script"
      },
      "template":{
        "crud":"crud-template",
        "task":{"crud":"crud-task-template"},
        "monitor":{"crud":"crud-monitor-template"}
      },
      "host":{
        "crud":"crud-host",
        "stats":"host-stats"
      },
      "task":{
        "crud":"crud-task",
        "execution":"task-execution",
      }
    }
  },
  "server": {
    "name": "TheEye",
    "version": process.env.VERSION || "0.0.0",
    "port": process.env.PORT || 60080,
    "auth_strategy": "bearer",
  },
  "dispatcher": {
  }
}
