const mongodb = require('../core/lib/mongodb')
const assert = require('chai').assert
const mongoose = require('mongoose')
const LIFECYCLE = require('../core/constants/lifecycle')
const JOBS = require('../core/constants/jobs')

describe('Job Models Discriminator',function(){

  var Job, ScraperJob, ScriptJob, AgentUpdateJob

  before(function(done){
    mongodb.connect(function(){
      Job = require('../core/entity/job').Job
      ScraperJob = require('../core/entity/job').Scraper
      ScriptJob = require('../core/entity/job').Script
      AgentUpdateJob = require('../core/entity/job').AgentUpdate
      done()
    })
  })

  after(function(done){
    done()
  })

  it('create Generic Job', function(done){
    var job = new Job({ });
    job.save( err => {
      assert.ifError(err);
      assert.ok(!job._type, JOBS.DEFAULT_TYPE,'Generic job should not have a _type');
      done()
    })
  })

  it('create Script Job', function(done){
    let script = new ScriptJob({ });
    script.save( err => {
      assert.ifError(err);
      assert.equal(script._type, JOBS.SCRIPT_TYPE,'The job _type is not equal')
      done()
    })
  })

  it('create Scraper Job', function(done){
    let scraper = new ScraperJob({ });
    scraper.save( err => {
      assert.ifError(err);
      assert.equal(scraper._type, JOBS.SCRAPER_TYPE,'The job _type is not equal')
      done()
    })
  })

  var hostId = mongoose.Types.ObjectId()
  var updateJob

  describe('Create an Agent Update Job',function(){
    it('create Agent Update Job', function(done){
      AgentUpdateJob.create({
        host_id: hostId
      },function(err, job){
        assert.ifError(err)
        assert.equal(job._type, JOBS.AGENT_UPDATE_TYPE, 'The job _type is not equal')
        assert.equal(job.lifecycle, LIFECYCLE.READY, 'The job state is wrong')
        assert.equal(job.name, JOBS.AGENT_UPDATE, 'The job name is wrong')
        updateJob = job
        done()
      })
    })
  })

  describe('Create another Agent Update Job',function(){
    it('does not create a second Update Job', function(done){
      AgentUpdateJob.create({
        host_id: hostId
      },function(err, job){
        assert.ifError(err);
        assert.equal(job._type, JOBS.AGENT_UPDATE_TYPE, 'The job _type is not equal')
        assert.equal(job.lifecycle, LIFECYCLE.READY, 'The job state is wrong')
        assert.equal(job.name, JOBS.AGENT_UPDATE, 'The job name is wrong')
        assert.equal(updateJob._id.toString(), job._id.toString(), `Update job ${job._id} does not match ${updateJob._id}`)
        done()
      })
    })
  })
})
