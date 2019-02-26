var config = require('config') ;
var nodemailer = require('nodemailer');

/**
 * http://www.nodemailer.com/
 */
var mailercfg = config.get('mailer');
var trType = mailercfg.transport.type;
var options = mailercfg.transport.options || {};
switch(trType)
{
  case 'ses':
    var transport = require('nodemailer-ses-transport')(options);
    break;
  case 'sendmail':
    var transport = require('nodemailer-sendmail-transport')(options);
    break;
  case 'smtp':
    var transport = require('nodemailer-smtp-transport')(options);
    break;
  default:
    var msg = 'nodemailer transport ' + trType + ' not implemented.';
    throw new Error(msg);
    break;
}

var transporter = nodemailer.createTransport(transport);

module.exports = {
  sendMail: function (options, callback) {
    var config = mailercfg
    var from = config
      .from
      .replace(/%customer%/g, options.customer_name) 

    options.from = from
    options.replyTo = config.reply_to

    if (
      config.only_support ||
      (!options.to && !options.bcc)
    ) {
      options.to = config.support.join(',')
    } else if (config.include_support_bcc) {
      options.bcc = config.support.join(',')
    }

    transporter.sendMail(options, callback)
  }
}
