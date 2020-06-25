const config = require('config')
const got = require('got')
const mailer = require('../lib/mailer')
const logger = require('../lib/logger')('service:notification')
const uuidv1 = require('uuid/v1')

module.exports = {
  sendEmailNotification (options) {
    if (!options.to && !options.bcc) {
      logger.error('failed to send email')
      logger.error(new Error('no recipients'))
      return
    }

    const setup = {
      customer_name: options.customer_name,
      subject: options.subject,
      html: options.content
    }

    if (options.to) {
      setup.to = options.to
    }

    if (options.bcc) {
      setup.bcc = options.bcc
    }

    mailer.sendMail(setup, function(error, info){
      if (error) {
        logger.error('failed to send email')
        logger.error(error)
      } else {
        logger.log('Message sent: ' + JSON.stringify(info))
      }
    })
  },
  /**
   * @param {Object} payload
   * @property {String} payload.data
   * @property {String} payload.topic
   */
  generateSystemNotification (payload) {
    let url = config.notifications.api.url
    if (config.notifications.api.secret) {
      url += '?secret=' + config.notifications.api.secret
    }

    //if (!url || !isURL(url)) return logger.error('notification event aborted. invalid url %o', url)
    if (!url) { return logger.error('notification event aborted. invalid url %o', url) }
    if (!payload) { return logger.error('notification event aborted. invalid payload %o', payload) }
    if (!payload.topic) { return logger.error('notification event aborted. invalid payload topic %o', payload) }
    if (!payload.data) { return logger.error('notification event aborted. invalid payload data %o', payload) }

    if (payload.data && payload.data.model) {
      if (payload.data.model.constructor.name === 'model') {
        payload.data.model = payload.data.model.toObject()
      }

      if (payload.topic === "job-crud") {
        // remove arguments
        if (Array.isArray(payload.data.model.task_arguments_values)) {
          let args = payload.data.model.task_arguments_values

          args.forEach((arg, index) => {
            if (/^data:.*;base64,/.test(arg) === true) {
              args[index] = 'File content'
            }
          })

          payload.data.model.task_arguments_values = args
          payload.data.model.script_arguments = args
        }
      }
    }

    payload.id = uuidv1()

    got
      .post(url, {
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(function (res) {
        if (res.statusCode != 200) {
          logger.error('submit to notification system failed')
          logger.debug('payload %j', payload)
          logger.error('%s, %o', res.statusCode, body)
        } else if (res.body) {
          logger.log('notification registered')
          logger.log(res.body.replace(/(\r\n|\n|\r)/gm,''))
        } else {
          logger.error('unhandled response message')
          logger.debug(arguments)
        }
      })
      .catch(err => {
        logger.error('notification system failure')
        logger.error(err)
      })
  }
}
