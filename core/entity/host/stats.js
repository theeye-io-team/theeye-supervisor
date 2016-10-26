var Schema = require('mongoose').Schema;
var mongodb = require("../../lib/mongodb");
var date = new Date();

var EntitySchema = Schema({
	host_id : { type : String },
	customer_name : { type : String, index : true },
	creation_date : { type : Date, default : date },
	last_update : { type : Date, default : date },
	last_update_timestamp : { type : Number, default : date.getTime() },
  type : { type : String },
	stats : {}
});

EntitySchema.statics.create = function(host,type,stats,next) {
  var entity = new Entity({
    host_id : host._id,
    customer_name : host.customer_name,
    type : type,
    stats : stats
  });

  entity.save(err => {
    if(next) next(null,entity);
  });
};

var Entity = mongodb.db.model('HostStats',EntitySchema);
exports.Entity = Entity;
