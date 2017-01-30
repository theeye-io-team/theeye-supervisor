'use strict';

var mongodb = require("../lib/mongodb");
var Schema  = require('mongoose').Schema;

var FetchBy = require('../lib/fetch-by');

var EntitySchema = Schema({
  token: { type:String, index:true },
  client_id: { type:String, index:true },
  client_secret: { type:String },
  username: { type:String, required:false, 'default':null },
  email: { type:String, unique:true, required:true, dropDups:true },
  emails: { type:Array, 'default':[] },
  customers: [{
    customer: { type:Schema.Types.ObjectId, ref:'Customer' },
    _id:String,
    name:String
  }],
  credential: { type:String , 'default':null },
  enabled: { type:Boolean, 'default':false },
  last_update: { type:Date, 'default':new Date() },
  creation_date: { type:Date, 'default':new Date() },
  timestamp: { type:String, 'default':Date.now() },
});

// Duplicate the ID field.
EntitySchema.virtual('id').get(function(){
  return this._id.toHexString();
});
const def = {
  getters: true,
  virtuals: true,
  transform: function (doc, ret, options) {
    // remove the _id of every document before returning the result
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
}

EntitySchema.set('toJSON'  , def);
EntitySchema.set('toObject', def);


EntitySchema.methods.publish = function (options, nextFn) {
  var user = this;
  options = (options||{});
  nextFn = (nextFn||function(){});

  var pub = this.toObject();

  if (options.include_secret!==true) {
    delete pub.client_secret;
  }
  if (options.include_token!==true) {
    delete pub.token;
  }

  if (options.include_customers) {
    this.populate('customers.customer', (error) => {
      var pubCustomers = [];
      for(var c=0; c < user.customers.length; c++) {
        pubCustomers.push( user.customers[c].customer.publish() );
      }
      pub.customers = pubCustomers;
      nextFn(null, pub);
    });
  } else {
    nextFn(null, pub);
  }

  return pub;
}

EntitySchema.statics.fetchBy = function () {
  return FetchBy.apply(this,arguments);
}

var Entity = mongodb.db.model('User', EntitySchema)
Entity.ensureIndexes();

exports.Entity = Entity;
