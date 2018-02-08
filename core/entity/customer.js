"use strict";

const mongodb = require("../lib/mongodb");
const mongoose = require('mongoose');
const util = require('util');

function Schema () {
  mongoose.Schema.call(this,{
    name: {
      type: String,
      index: true,
      unique: true,
      required: true,
      dropDups: true
    },
    description: { type: String, default: '' },
    owner_id: { type: mongoose.Schema.Types.ObjectId },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    config: { type: Object, default: function(){
      return {
        monitor: {},
        kibana: null,
        elasticsearch: {
          enabled: false,
          url: ''
        },
        ngrok: {
          enabled: false,
          authtoken: '',
          address: '',
          protocol: ''
        }
      }
    } },
    creation_date: {
      type: Date,
      default: new Date()
    }
  });

  // Duplicate the ID field.
  this.virtual('id').get(function(){
    return this._id.toHexString();
  });

  const def = {
    getters: true,
    virtuals: true,
    transform: function (doc, ret, options) {
      // remove the _id of every document before returning the result
      ret.id = ret._id.toHexString();
      delete ret._id;
      delete ret.__v;
    }
  }

  this.set('toJSON'  , def);
  this.set('toObject', def);

  this.pre('save', function(next) {
    this.last_update = new Date();
    // do stuff
    next();
  });

  this.methods.publish = function(){
    return this.toObject();
  }
}

util.inherits(Schema, mongoose.Schema);

var Entity = mongodb.db.model('Customer', new Schema());
Entity.ensureIndexes();
exports.Entity = Entity;
