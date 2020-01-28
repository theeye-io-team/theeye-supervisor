var config = require('config')
var notification = require('../service/notification')

function ErrorHandler () {
  this.errors = []
}

module.exports = ErrorHandler

const errorLine = (error) => {
  let message = error.message
  let statusCode = error.statusCode
  let dump = error.dump

  let html = `<h2>Exception</h2><pre>${error.stack}</pre>`

  if (statusCode) {
    html += `<p><h3>status code</h3> ${statusCode}</p>`
  }

  if (dump) {
    html += `<p><h3>error dump</h3> ${JSON.stringify(dump)}</p>`
  }

  return html
}

ErrorHandler.prototype = {
  required (name, value, message) {
    var e = new Error(name + ' is required')
    e.statusCode = 400
    e.field = name
    e.value = value
    e.code = 'EREQ'
    e.message = message
    this.errors.push( e )
		return this
  },
  invalid (name, value, message) {
    var e = new Error(name + ' is invalid')
    e.statusCode = 400
    e.field = name
    e.value = value
    e.code = 'EVALID'
    e.message = message
    this.errors.push( e )
		return this
  },
  /**
   *
   * turn object into Array.
   * Array knows how turn it self into string
   *
   */
  toString () {
    var e = [];
    for (var i=0; i<this.errors.length; i++) {
      var err = this.errors[i];
      delete err.stack;
      e.push(err);
    }
    return e;
  },
  toHtml () {
    var e = [];
    for(var i=0; i<this.errors.length; i++){
      e.push( errorLine( this.errors[i] ) );
    }
    return e.join('<br/>');
  },
  hasErrors () {
    return this.errors.length > 0;
  },
  sendExceptionAlert (error) {
    this.errors.push(error)
    notification.sendEmailNotification({
      customer_name: 'theeye',
      subject: 'Supervisor Exception',
      to: config.mailer.support.join(','),
      content: this.toHtml()
    })
  }
}

ErrorHandler.prototype.toJSON = ErrorHandler.prototype.toString
