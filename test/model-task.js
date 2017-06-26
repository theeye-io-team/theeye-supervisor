"use strict";

var mongodb = require('../core/lib/mongodb');
//var assert = require('chai').assert;
var mongoose = require('mongoose');

mongodb.connect(function(){

  var Task = require('../core/entity/task').Entity;
  var ScraperTask = require('../core/entity/task/scraper').Entity;

  Task.find({
    host_id: '592ed70fe552b57b1e8cb7c2',
    //template_id: mongoose.Schema.Types.ObjectId('5936b36f14070b6f491da88e')
  }).exec((err,tasks) => {
    console.log(err,tasks)

    process.exit()
  })

})
