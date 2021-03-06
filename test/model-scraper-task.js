var mongodb = require('../core/lib/mongodb')
var assert = require('chai').assert

describe('testing scraper task model',function(){
  var ScraperTask, task

  before(function(done){
    mongodb.connect(function(){
      ScraperTask = require('../core/entity/task/scraper').Entity;
      done()
    })
  })

  after(function(done){
    done()
  })

  it('#save()', function(done){
    task = new ScraperTask({
      url:'http://test.scraper.io/resource',
      method:'GET',
      name:'TestScraperTask'
    });
    task.save(function(err){
      if (err) {
        assert.ifError(err)
        return done(err)
      }
      assert.equal(task._type,'ScraperTask','The task _type is not equal');
      done()
    })
  })

  it('#update()', function(done){
    task.success_status = 200;
    task.timeout = 5000;
    task.save(function(err){
      if (err) {
        assert.ifError(err)
        return done(err)
      }
      assert.equal(task.timeout,5000,'Timeout error');
      assert.equal(task.success_status,200,'Status Code error');
      done()
    })
  })

  it('#remove()', function(done){
    task.remove(function(err){
      if (err) {
        assert.ifError(err)
        return done(err)
      }
      done()
    })
  })

})
