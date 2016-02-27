var AWS = require('aws-sdk'); 
var SNS = new AWS.SNS();

var request = require('request');
var config = require('config');
var mailer = require('../lib/mailer');

var debug = require("../lib/logger")('eye:supervisor:service:notification');

module.exports = {
  sendSNSNotification : function(sns,options)
  {
    if( config.get("is_dev") )
    {
      debug.log('Submit Web SNS information(direct no AWS)');
      var req = request.post (
        config.get("system").web_url + options.apiRoute,
        { form : { Message : JSON.stringify(sns) } },
        function (error, response, body) {
          if( ! error && response.statusCode == 200 )
          {
            debug.log('web publishing success');
            debug.log(body.replace(/(\r\n|\n|\r)/gm,""));
          }
          else
          {
            debug.error('could not connect to local web');
            debug.error(error);
          }
        }
      );
    }
    else
    {
      debug.log('Submit SNS information');

      SNS.publish({
        TopicArn : options.topicArn,
        Message  : JSON.stringify(sns),
        Subject  : options.subject
      },function(error,data){
        if(error) debug.error(error);
        else debug.log(data);
      });
    }
  },
  sendEmailNotification : function(options)
  {
    mailer.sendMail({
      customer_name : options.customer_name,
      subject       : options.subject,
      html          : options.content,
      to            : options.to
    }, function(error, info){
      if( error ) {
        debug.error("failed to send email");
        debug.error(error);
      } else {
        debug.log('Message sent: ' + JSON.stringify(info)); 
      }
    });
  }
}
