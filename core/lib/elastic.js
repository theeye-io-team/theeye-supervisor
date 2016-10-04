var config = require('config');
var debug = require('debug')('eye::elastic');
var path = require('path');

var request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
});

var ElasticSearch = {
  submit : function(index,endpoint,data)
  {
    if( ! config.elasticsearch.enabled ){
      debug('elastic search disabled by config');
      return;
    }

    var elastic = config.elasticsearch ;
    if( !elastic.url || !elastic.db ){
      return debug('ERROR invalid elasticsearch configuration.');
    }

    data.type = endpoint;
    data.timestamp || ( data.timestamp = (new Date()).getTime() );
    data.date || ( data.date = (new Date()).toISOString() );

    var url = elastic.url + '/' + path.join(index, endpoint);

    request.post({
      url: url,
      body: data
    },function(err,respose,body){
      if(err) {
        debug('ERROR %s',err);
        debug(arguments);
        return;
      }
      debug('submit done to %s', url);
    });
  }
}

module.exports = ElasticSearch ;
