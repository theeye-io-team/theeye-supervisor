const logger = require('debug')('theeye:log:mailer')
const config = require('config').get('mailer')
const nodemailer = require('nodemailer')
const aws = require('aws-sdk')

/** http://www.nodemailer.com/ **/
const transportType = config.transport.type
const options = config.transport.options || {}
let transportSettings

switch (transportType) {
  case 'ses':
    logger('using ses transport')
    transportSettings = {
      SES: new aws.SES(
        Object.assign({
          apiVersion: "2010-12-01"
        }, options)
      )
    }
    break
  case 'sendmail':
    logger('using sendmail transport')
    transportSettings = {
      sendmail: true,
      newline: 'unix'
    }
    break
  case 'gmail':
    logger('using gmail transport')
    transportSettings = {
      service: 'Gmail',
      auth: {
        user: options.user,
        pass: options.pass
      }
    }
    break
  case 'smtp':
    logger('using smtp transport')
    transportSettings = options
    break
  default:
    let msg = `nodemailer transport ${transportType} not implemented.`
    logger(msg)
    throw new Error(msg)
    break
}

let transport = nodemailer.createTransport(transportSettings)

module.exports = {
  sendMail: function (options, callback) {
    let from = config
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

    if (options.to) {
      options.to = options.to.toLowerCase()
    }

    if (options.bcc) {
      options.bcc = options.bcc.toLowerCase()
    }

    transport.sendMail(options, callback)
  }
}
