var Job = require( process.env.BASE_PATH + '/entity/job' ).Entity;
var async = require('async');

var service = {
  fetchBy : function(input,next)
  {
    var query = {};

    if( input.host ) query.host_id = input.host._id ;
    if( input.state ) query.state = input.state ;

    Job.find(query,function(error, jobs){
      next( jobs );
    });
  },
  processNextJob : function(input,next)
  {
    var query = {};
    query.state = "new";
    query.host_id = input.host._id;

    Job.findOne(query,function(error,job){
      if( job != null )
      {
        job.state = "sent";
        job.save(function(){
          job.publish(function(pub){
            next(null,pub);
          });
        });
      }
      else next(null,null);
    });
  }
};

module.exports = service ;
