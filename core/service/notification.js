const config = require('config')
const request = require('request')
const mailer = require('../lib/mailer')
const logger = require('../lib/logger')('service:notification')
const uuidv1 = require('uuid/v1')

module.exports = {
  sendEmailNotification (options) {
    mailer.sendMail({
      customer_name: options.customer_name,
      subject: options.subject,
      html: options.content,
      to: options.to
    }, function(error, info){
      if( error ) {
        logger.error('failed to send email');
        logger.error(error);
      } else {
        logger.log('Message sent: ' + JSON.stringify(info));
      }
    });
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

    payload.id = uuidv1()

    request({
      followRedirect: false,
      method: 'POST',
      uri: url,
      json: payload
    }, function (error, response, body) {
      if (error) {
        logger.error('could not connect to local notification system')
        logger.error(error)
      } else if (response.statusCode != 200) {
        logger.error('submit to local notification system failed')
        logger.debug('payload %j', payload)
        logger.error('%s, %o', response.statusCode, body)
      } else {
        logger.log('notification registered')
        logger.log(body.replace(/(\r\n|\n|\r)/gm,''))
      }
    })
  }
}
