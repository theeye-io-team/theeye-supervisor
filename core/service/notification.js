const config = require('config')
const request = require('request')
const mailer = require('../lib/mailer')
const debug = require('../lib/logger')('service:notification')
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
        debug.error('failed to send email');
        debug.error(error);
      } else {
        debug.log('Message sent: ' + JSON.stringify(info)); 
      }
    });
  },
  /**
   * @param {Object} payload
   * @property {String} payload.data
   * @property {String} payload.topic
   */
  generateSystemNotification (payload) {
    const url = config.notifications.api.url
    //if (!url || !isURL(url)) return debug.error('notification event aborted. invalid url %o', url)
    if (!url) return debug.error('notification event aborted. invalid url %o', url)
    if (!payload) return debug.error('notification event aborted. invalid payload %o', payload)
    if (!payload.topic) return debug.error('notification event aborted. invalid payload topic %o', payload)
    if (!payload.data) return debug.error('notification event aborted. invalid payload data %o', payload)

    payload.id = uuidv1()

    request({
      followRedirect: false,
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
}
