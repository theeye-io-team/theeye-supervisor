
var config = require('config');
var AWS = require('aws-sdk'); 
var SNS = new AWS.SNS( new AWS.Config( config.aws ) );
var request = require('request');
var mailer = require('../lib/mailer');
var debug = require('../lib/logger')('service:notification');

module.exports = {
  sendSNSNotification : function(sns,options)
  {
    if( config.get('is_dev') )
    {
      var websnscfg = config.get('web-sns');
      var webroute = config.get('system').web_url +
        websnscfg.topicEndpoint[ options.topic ];

      var params = { 'form' : { 'Message' : JSON.stringify(sns) } };

      debug.log('Submit Web SNS information(direct no AWS) to %s', webroute);
      var req = request.post(
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
      );
    }
    else
    {
      debug.log('Submit SNS information');
      var snscfg = config.get('sns');

      SNS.publish({
        'TopicArn': snscfg.topicArn[ options.topic ],
        'Message': JSON.stringify(sns),
        'Subject': options.subject
      },function(error,data){
        if(error) debug.error(error);
        else debug.log(data);
      });
    }
  },
  sendEmailNotification : function(options)
  {
    mailer.sendMail({
      'customer_name': options.customer_name,
      'subject': options.subject,
      'html': options.content,
      'to': options.to
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
