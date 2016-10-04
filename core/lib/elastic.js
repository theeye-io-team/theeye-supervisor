var config = require('config');
var debug = require('debug')('eye::elastic');
var path = require('path');

var request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
});

var ElasticSearch = {
  submit : function(index,key,data)
  {
    var prefix = config.elasticsearch.keys.prefix
    if( prefix ) key = prefix + key ;

    if( ! config.elasticsearch.enabled ){
      debug('elastic search disabled by config');
      return;
    }

    var elastic = config.elasticsearch ;
    if( !elastic.url || !elastic.db ){
      return debug('ERROR invalid elasticsearch configuration.');
    }

    data.type = key;
    data.timestamp || ( data.timestamp = (new Date()).getTime() );
    data.date || ( data.date = (new Date()).toISOString() );

    var url = elastic.url + '/' + path.join(index,key);

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
