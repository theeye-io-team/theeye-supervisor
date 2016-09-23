"use strict";

var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;
var mongoose = require('mongoose');

mongodb.connect(function(){

  var Dispatcher = require('../core/service/events');
  var Event = require('../core/entity/event').Event;

  describe('Event Dispatcher',function(){
    it('dispatch an event', function(done){

      Event
        .findById({ _id: '57e3014b045b584d4ff1ede1'  })
        .exec( (err,event) => {

          Dispatcher.initialize( () => {
            dispatch( event );
          })

        });

    });
  });
});
