
function Mailer(tr,cfg) {
  this.transporter = tr ;
  this.config = cfg ;
}

Mailer.prototype.sendMail = function(options,callback) {
  var config = this.config ;
  var from = config.from.replace(/%customer%/g, options.customer_name) ;

  options.from = from;
  options.replyTo = config.reply_to;

  if( config.only_support || ! options.to ) {
    options.to = config.support.join(',');
  } else if( config.include_support_bcc ) {
    options.bcc = config.support.join(',');
  }

  this.transporter.sendMail(options,callback);
}

/**
 * http://www.nodemailer.com/
 */
var nodemailer = require('nodemailer');
var sendmailTransport = require('nodemailer-sendmail-transport');
var transporter = nodemailer.createTransport( sendmailTransport() );

var config = require('config').get('mailer') ;

module.exports = new Mailer( transporter, config ) ;
