'use strict'

var config = require('config');
var AWS = require('aws-sdk'); 
var SNS = new AWS.SNS( new AWS.Config( config.aws ) );
var request = require('request');
var mailer = require('../lib/mailer');
var debug = require('../lib/logger')('service:notification');
//const isURL = require('validator/lib/isURL')

module.exports = {
  sendSNSNotification (data,options) {
    let message = JSON.stringify(data)
    let topic = options.topic
    let subject = options.subject

    if ( config.get('is_dev') ) {
      var websnscfg = config.get('web-sns');
      var webroute = config.get('system').web_url +
        websnscfg.topicEndpoint[topic];

      var params = { form: { Message: message } }

      debug.log('Submit Web SNS information(direct no AWS) to %s', webroute);
      const req = request.post(
        webroute,
        params,
        function (error, response, body) {
          if( error || response.statusCode != 200 ) {
            debug.error('could not connect to local web');
            debug.error(error);
          } else {
            debug.log('web publishing success');
            debug.log(body.replace(/(\r\n|\n|\r)/gm,''));
          }
        }
      )
    } else {
      debug.log('Submit SNS information');
      const snscfg = config.get('sns');

      SNS.publish({
        TopicArn: snscfg.topicArn[topic],
        Message: message,
        Subject: subject
      },function(error,data){
        if (error) {
          debug.error('SNS submit error')
          debug.error(error)
        }
        else debug.log(data);
      });
    }

    generateSystemNotification({
      topic: topic,
      data: data
    })
  },
  sendEmailNotification (options) {
    mailer.sendMail({
      customer_name: options.customer_name,
      subject: options.subject,
      html: options.content,
      to: options.to
    }, function(error, info){
      if( error ) {
        debug.error('failed to send email');
        debug.error(error);
      } else {
        debug.log('Message sent: ' + JSON.stringify(info)); 
      }
    });
  }
}

/**
 * @param {Object} payload
 * @property {String} payload.data
 * @property {String} payload.topic
 */
const generateSystemNotification = (payload) => {
  const url = config.notifications.api.url
  //if (!url || !isURL(url)) return debug.error('notification event aborted. invalid url %o', url)
  if (!url) return debug.error('notification event aborted. invalid url %o', url)
  if (!payload || !payload.data) return debug.error('notification event aborted. invalid payload %o', payload)

  request({
    method: 'POST',
    uri: url,
    json: payload
  }, function (error, response, body) {
    if (error) {
      debug.error('could not connect to local notification system')
      debug.error(error)
    } else if (response.statusCode != 200) {
      debug.error('submit to local notification system failed')
      debug.error('%s, %o', response.statusCode, body)
    } else {
      debug.log('notification registered')
      debug.log(body.replace(/(\r\n|\n|\r)/gm,''))
    }
  })
}
