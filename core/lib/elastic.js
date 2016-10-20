var config = require('config');
var logger = require('./logger')(':elastic');
var path = require('path');

var request = require("request").defaults({
  timeout: 5000,
  json: true,
  gzip: true
});

var ElasticSearch = {
  submit : function(index,key,data)
  {
    //var prefix = config.elasticsearch.keys.prefix
    //if( prefix ) key = prefix + key ;

    if( ! config.elasticsearch.enabled ){
      logger.log('elastic search disabled by config');
      return;
    }

    var elastic = config.elasticsearch ;
    if( !elastic.url || !elastic.db ){
      return logger.log('ERROR invalid elasticsearch configuration.');
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
        logger.error('ERROR %s',err);
        logger.error(arguments);
        return;
      }
      logger.log('submit done to %s', url);
    });
  }
}

module.exports = ElasticSearch ;
