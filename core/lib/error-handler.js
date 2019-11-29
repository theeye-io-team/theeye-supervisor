var config = require('config');
var notification = require('../service/notification');

function ErrorHandler () {
  this.errors = []
}

module.exports = ErrorHandler

const errorLine = (error) => {
  var message = error.message;
  var statusCode = error.statusCode;

  var html = '<h2>Exception</h2>' ;
  html += '<pre>' + error.stack + '</pre>' + "\n" ;
  if(statusCode){
    html += `<p>status code : ${statusCode}</p>`;
  }
  return html;
}

ErrorHandler.prototype = {
  required: function(name,value,message){
    var e = new Error(name + ' is required')
    e.statusCode = 400
    e.field = name
    e.value = value
    e.code = 'EREQ'
    e.message = message
    this.errors.push( e )
		return this
  },
  invalid: function(name,value,message){
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
  toString: function(){
    var e = [];
    for (var i=0; i<this.errors.length; i++) {
      var err = this.errors[i];
      delete err.stack;
      e.push(err);
    }
    return e;
  },
  toHtml: function(){
    var e = [];
    for(var i=0; i<this.errors.length; i++){
      e.push( errorLine( this.errors[i] ) );
    }
    return e.join('<br/>');
  },
  hasErrors: function(){
    return this.errors.length > 0;
  },
  sendExceptionAlert: function(error){
    this.errors.push( error );
    notification.sendEmailNotification({
      customer_name: 'theeye',
      subject: 'Supervisor Exception',
      to: config.mailer.support.join(','),
      content: this.toHtml()
    })
  }
}

ErrorHandler.prototype.toJSON = ErrorHandler.prototype.toString
