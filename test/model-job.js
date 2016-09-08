var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;

mongodb.connect(function(){

  var Job = require('../core/entity/job').Entity;
  var ScraperJob = require('../core/entity/job/scraper').Entity;
  var ScriptJob = require('../core/entity/job/script').Entity;
  var job, script, scraper ;

  describe('Job Models Discriminator',function(){

    it('create Generic Job', function(done){
      job = new Job({ });
      job.save( err => {
        assert.ifError(err);
        assert.ok(!job._type,'Job','Generic job should not have a _type');
        done();
      });
    });

    it('create Script Job', function(done){
      script = new ScriptJob({ });
      script.save( err => {
        assert.ifError(err);
        assert.equal(script._type,'ScriptJob','The job _type is not equal');
        done();
      });
    });


    it('create Scraper Job', function(done){
      scraper = new ScraperJob({ });
      scraper.save( err => {
        assert.ifError(err);
        assert.equal(scraper._type,'ScraperJob','The job _type is not equal');
        done();
      });
    });

  });
});
