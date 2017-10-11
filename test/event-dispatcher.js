"use strict";

var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;
var mongoose = require('mongoose');

describe('Event Dispatcher',function(){
  var Dispatcher, Event

  before(function(done){
    mongodb.connect(function(){
      Dispatcher = require('../core/service/events')
      Event = require('../core/entity/event').Event
      done()
    })
  })

  after(function(done){
    done()
  })

  it('dispatch an event', function(done){
    let query = Event.findOne()
    query.exec( (err,event) => {
      assert.ifError(err)
      assert.isNotNull(event, 'event not found')
      Dispatcher.initialize( () => {
        Dispatcher.dispatch( event, {}, (err, tasks) => {
          assert.ifError(err)
          done()
        })
      })
    })
  })
})
