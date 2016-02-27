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

EntitySchema.methods.publish = function(next){
  return {
    id: this.id,
    host_id: this.host_id,
    type: this.type,
    stats: this.stats
  };
}

EntitySchema.statics.create = function(host,type,stats,next)
{
    var entity = new Entity({
        host_id : host._id,
        customer_name : host.customer_name,
        type : type,
        stats : stats
    });

    entity.save(function(){
        if(next) next(null,entity);
    });
};

/**
 * database id's are only accessed by the supervisor
 * on internal querys.
 * if data is invalid or bad linked error are thrown here
 */
EntitySchema.statics.findOneByHostAndType = function(host_id,type,next)
{
    this.findOne({
        'host_id' : host_id,
        'type' : type
    },function(error,stats){
        if(error)
        {
            console.error(error);
            if(next) next(error,null);
        }
        else if(stats == null)
        {
            if(next) next(false,null);
        }
        else if(next) next(null,stats);
    })
};

var name = 'HostStats' ;
var Entity = mongodb.db.model(name, EntitySchema)

exports.Entity = Entity;
