
var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;
var mongoose = require('mongoose');

mongodb.connect(function(){

  var DefaultEvent = require('../core/entity/event').Event;
  var TaskEvent = require('../core/entity/event').TaskEvent;
  var MonitorEvent = require('../core/entity/event').MonitorEvent;
  //var WebhookEvent = require('../core/entity/event').WebhookEvent;

  describe('Event Models Discriminator',function(){

    it('create Generic Event', function(done){
      var event = new DefaultEvent({ });
      event.save( err => {
        assert.ifError(err);
        assert.ok(!event._type,'Event','Generic event should not have a _type');
        done();
      });
    });

    it('create Task Event', function(done){
      var event = new TaskEvent({ });
      event.save( err => {
        assert.ifError(err);
        assert.equal(event._type,'TaskEvent','The event _type is not equal');
        done();
      });
    });

    it('create Monitor Event', function(done){
      var event = new MonitorEvent({ });
      event.save( err => {
        assert.ifError(err);
        assert.equal(event._type,'MonitorEvent','The event _type is not equal');
        done();
      });
    });
  });

});
