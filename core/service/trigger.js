var Trigger = require(process.env.BASE_PATH + "/entity/trigger").Entity;

var name = 'eye:supervisor:service:trigger';
var debug = {
  log   : require('debug')(name),
  error : require('debug')(name + ':error'),
}

service = {
  find : function(state,resource,next) {
    Trigger.findOne({
      resource_state: state ,
      resource_id: resource._id
    }, function(error,trigger){
      if( error )
      {
        debug.error(error);
        next(null);
      }
      else next(null,trigger);
    });
  }
};

module.exports = service ;
