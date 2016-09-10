var mongodb = require('../core/lib/mongodb');
var assert = require('chai').assert;
var mongoose = require('mongoose');

mongodb.connect(function(){

  var Job = require('../core/entity/job').Entity;
  var ScraperJob = require('../core/entity/job/scraper').Entity;
  var ScriptJob = require('../core/entity/job/script').Entity;
  var AgentUpdateJob = require('../core/entity/job/agent-update').Entity;
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

    describe('Create Agent Update Job',function(){
      var update ;
      var hostId = mongoose.Types.ObjectId();
      before(function(done){
        AgentUpdateJob.create({
          host_id: hostId
        },function(err, job){
          assert.ifError(err);
          update = job;
          done();
        });
      });

      it('create Agent Update Job', function(done){
        assert.equal(update._type,'AgentUpdateJob','The job _type is not equal');
        assert.equal(update.state,'new','The job state is wrong');
        assert.equal(update.name,'agent:config:update','The job name is wrong');

        describe('Create another Agent Update Job',function(){
          it('does not create a second Update Job', function(done){
            AgentUpdateJob.create({
              host_id: hostId
            },function(err, job){
              assert.ifError(err);
              assert.equal(job._type,'AgentUpdateJob','The job _type is not equal');
              assert.equal(job.state,'new','The job state is wrong');
              assert.equal(job.name,'agent:config:update','The job name is wrong');
              assert.deepEqual(update.toObject(),job.toObject(),'The job is not the same');
              done();
            });
          });
        });

        done();
      });
    });
  });

});
