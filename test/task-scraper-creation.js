var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;

mongodb.connect(function(){

  var ScraperTask = require('../core/entity/task/scraper').Entity;
  var task ;

  describe('Scraper Task Entity',function(){

    it('#save()', function(done){
      task = new ScraperTask({
        url:'http://test.scraper.io/resource',
        method:'GET',
        name:'TestScraperTask'
      });
      task.save( err => {
        assert.ifError(err);
        assert.equal(task._type,'ScraperTask','The task _type is not equal');
        done();
      });
    });

    it('#update()', function(done){
      task.success_status = 200;
      task.timeout = 5000;
      task.save( err => {
        assert.ifError(err);
        assert.equal(task.timeout,5000,'Timeout error');
        assert.equal(task.success_status,200,'Status Code error');
        done();
      });
    });

    it('#remove()', function(done){
      task.remove( err => {
        assert.ifError(err);
        done();
      });
    });
  });

});
