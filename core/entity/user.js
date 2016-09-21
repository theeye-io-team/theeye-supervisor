var mongodb = require("../lib/mongodb");
var Schema  = require('mongoose').Schema;

var EntitySchema = Schema({
  token : { type : String, index : true },
  client_id	: { type : String, index : true },
  client_secret : { type : String },
  email : { type : String, unique : true, required : true, dropDups: true },
  emails : { type : Array, 'default': [] },
  customers : [{
    customer : { type : Schema.Types.ObjectId, ref : 'Customer' },
    _id : String,
    name : String
  }],
  username: { type : String, required: false },
  credential : { type : String , 'default' : null },
  enabled : { type : Boolean, 'default' : false },
  last_update : { type : Date, 'default' : new Date() },
  creation_date : { type : Date, 'default' : new Date() },
  timestamp : { type : String, 'default' : Date.now() },
});

EntitySchema.methods.publish = function(options, nextFn)
{
  var user = this;
  options = options || {};
  nextFn = nextFn || function(){};

  var pub = {
    id: user._id,
    token : user.token,
    client_id	: user.client_id,
    email : user.email,
    customers : user.customers,
    credential : user.credential,
    enabled : user.enabled,
    last_update : user.last_update,
    creation_date : user.creation_date,
  };

  if(options.publishSecret)
    pub.client_secret = user.client_secret ;

  if(options.populateCustomers) {
    Entity.populate(user, { path:'customers.customer' }, function(error, user){
      var pubCustomers = [];
      for(var c=0; c < user.customers.length; c++) {
        pubCustomers.push( user.customers[c].customer.publish() );
      }
      pub.customers = pubCustomers;
      nextFn(null, pub);
    });
  } else nextFn(null, pub);

  return pub;
}

var Entity = mongodb.db.model('User', EntitySchema)
Entity.ensureIndexes();

exports.Entity = Entity;
