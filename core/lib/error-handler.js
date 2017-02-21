var config = require('config');
var notification = require('../service/notification');

var ErrorHandler = function(){
  var errors = [];

  this.required = function(name,value){
    var e = new Error(name + ' is required');
    e.statusCode = 400;
    e.field = name;
    e.value = value;
    e.code = 'EREQ';
    errors.push( e );
		return e;
  }

  this.invalid = function(name,value){
    var e = new Error(name + ' is invalid');
    e.statusCode = 400;
    e.field = name;
    e.value = value;
    e.code = 'EVALID';
    errors.push( e );
		return e;
  }

  /**
   *
   * turn object into Array.
   * Array knows how turn it self into string
   *
   */
  this.toString = function(){
    var e = [];
    for (var i=0; i<errors.length; i++) {
      var err = errors[i];
      delete err.stack;
      e.push(err);
    }
    return e;
  }

  this.toJSON = this.toString;

  function errorLine(error){
    var message = error.message;
    var statusCode = error.statusCode;

    var html = '<h2>Exception</h2>' ;
    html += '<pre>' + error.stack + '</pre>' + "\n" ;
    if(statusCode){
      html += `<p>status code : ${statusCode}</p>`;
    }
    return html;
  }

  this.toHtml = function(){
    var e = [];
    for(var i=0; i<errors.length; i++){
      e.push( errorLine( errors[i] ) );
    }
    return e.join('<br/>');
  }

  this.hasErrors = function(){
    return errors.length > 0;
  }

  this.sendExceptionAlert = function(error){
    errors.push( error );
    notification.sendEmailNotification({
      customer_name:'theeye',
      subject:'Supervisor Exception',
      to: config.support,
      content: this.toHtml()
    });
  }

  return this;
}

module.exports = ErrorHandler;
