var config = require('config');
var debug = require('debug')('eye:supervisor:lib:elastic');
var path = require('path');

var request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
});

var submitFn = function (index,endpoint, data) {

  if( ! config.elasticsearch.enabled ){
    debug('elastic search disabled by config');
    return;
  }

  var elastic = config.elasticsearch ;
  if( !elastic.url || !elastic.db ) return debug('ERROR invalid elasticsearch configuration.');

  request.post({
//Cambiado    url: path.join(elastic.url, elastic.db, endpoint), 
//Cambiado dos, cada customer va a tener su propia db.
    url: elastic.url+'/'+path.join(index, endpoint),
    body: data
  },function(err, httpResponse, body){
    if (!err) 
      debug(' elastic [url:'+elastic.url+'] [index:'+index+'] submited to "%s"', endpoint);
    else
      debug('joined '+elastic.url+path.join(index, endpoint)+'  elasticsearch post error!!!'+err);
  });
}

module.exports = { submit: submitFn }
