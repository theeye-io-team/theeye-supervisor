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
    "fails_count_alert": 4,
    /* cada cuanto tiempo chequear estado */
    "agents_check_disconnected_interval_milliseconds": 20000,
    /* despues de cuantos segundos de no enviar estado esta en alerta */
    "agents_alert_disconnected_interval_seconds": 60,
    /* cada cuanto tiempo chequear estado */
    "resources_check_failure_interval_milliseconds": 20000,
    /* despues de cuantos milisegundos de no actualizar estado entra en alerta */
    "resources_alert_failure_threshold_milliseconds": 40000
  },
  "agent": {
    "core_workers": {
      "host_ping": {
        "looptime":30000,
        "type":"keepAlive"
      }
    }
  },
  /* aws sns , s3 */
  "aws": {
    "username":"",
    "accessKeyId": "",
    "secretAccessKey": "",
    "region": "",
  },
  "sns": {
    "topicArn": {
      "events": "",
      "host-stats": "",
      "jobs": ""
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
    "db":""
  },
  "mailer": {
    "from": "The Eye %customer% <%customer%@theeye.io>",
    "reply_to": "Support <support@theeye.io>",
    "only_support": false,
    "include_support_bcc": false,
    "support": [
  //me quema la cabezaaa    "facugon@interactar.com",
  //me quema la cabezaaa    "jailbirt@interactar.com",
  //me quema la cabezaaa    "jgzurano@interactar.com"
    ]
  },
  "server": {
    "name": "TheEye", 
    "version": "1.0.0",
    "port": 60080,
    "auth_strategy": "bearer",
    "socket": false
  },
  "socket": {
    "enable": false
  }
}
