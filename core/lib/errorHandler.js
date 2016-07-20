var appRoot = require('app-root-path');
var notification = require(appRoot + '/service/notification');
var config = require('config');

var ErrorHandler = function(){
  var errors = [];

  this.required = function(name){
    var e = new Error(name + ' is required');
    e.statusCode = 400;
    errors.push( e );
		return e;
  }

  this.invalid = function(name,value){
    var e = new Error(name + ' is invalid');
    e.statusCode = 400;
    e.extras = value;
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
    for(var i=0; i<errors.length; i++){
      e.push({
        'message': errors[i].message, 
        'statusCode': errors[i].statusCode, 
        'extras': errors[i].extras 
      });
    }
    return e;
  }

  function errorLine(error){
    var message = error.message;
    var statusCode = error.statusCode;
    var extras = error.extras;

    var html = '<h2>Exception</h2>' ;
    html += '<pre>' + error.stack + '</pre>' + "\n" ;
    if(statusCode){
      html += `<p>status code : ${statusCode}</p>`;
    }
    if(extras){
      var str = JSON.stringify(extras);
      html += `<p>extras : ${str}</p>`;
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
