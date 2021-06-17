const config = require('config')
const got = require('got')
const mailer = require('../lib/mailer')
const logger = require('../lib/logger')('service:notification')
const { v1: uuidv1 } = require('uuid')
const TopicsConstants = require('../constants/topics')

module.exports = {
  sendEmailNotification (options) {
    if (!options.to && !options.bcc) {
      const err = new Error('no recipients')
      logger.error('failed to send email. %s', err.message)
      return
      //throw err
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
   * @return {Promise}
   */
  async generateSystemNotification (payload) {
    try {
      if (!config.notifications.api.url) { return logger.error('notification event aborted. url required') }
      if (!payload) { return logger.error('notification event aborted. invalid payload %o', payload) }
      if (!payload.topic) { return logger.error('notification event aborted. invalid payload topic %o', payload) }
      if (!payload.data) { return logger.error('notification event aborted. invalid payload data %o', payload) }

      if (payload.data && payload.data.model) {
        if (payload.data.model.constructor.name === 'model') {
          payload.data.model = payload.data.model.toObject()
        }

        if (payload.topic === TopicsConstants.job.crud) {
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

      const res = await got.post(config.notifications.api.url, {
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        searchParams: {
          secret: config.gateway.secret
        }
      })

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

      return res
    } catch (err) {
      logger.error('notification system failure')
      logger.error(err)
      return err
    }
  }
}
