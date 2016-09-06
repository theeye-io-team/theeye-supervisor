var assert = require('chai').assert;

var notifications =  require('../core/service/resource/email-notifications');
var Constants = require('../core/service/resource/constants');

var script = { 'description':'script monitor', 'hostname':'dracolagoon.com', 'type':'script', };
var dstat = { 'description':'dstat monitor', 'hostname':'dracolagoon.com', 'type':'dstat', };
var events = [
  {name:'host:stats:cpu:high',data:{cpu:'90'}},
  {name:'host:stats:mem:high',data:{mem:'90'}},
  {name:'host:stats:cache:high',data:{cache:'90'}},
  {name:'host:stats:disk:high',data:undefined},
  {name:'host:stats:normal',data:undefined},
];

describe('Dstat Monitor',function() {
  describe('#failure event',function() {
    it('should return an alert subject with LOW tag', function() {
      var failure = events[0];
      notifications(dstat,failure.name,failure.data,(error,specs) => {
        assert.ifError(error);
        assert.notMatch(specs.subject,/^[LOW].*alert/,'the subject does not match');
      });
    });
  });

  describe('#recover event',function() {
    it('should return a STATS recovered subject with LOW tag', function() {
      var recover = events[4];
      notifications(dstat,recover.name,recover.data,(error,specs) => {
        assert.ifError(error);
        assert.notMatch(specs.subject,/^[LOW].*STATS recovered$/,'the subject does not match');
      });
    });
  });

  describe('#null event',function() {
    it('should return the error: [Error: dstat/null event ignored.]', function() {
      notifications(dstat,null,events[0].data,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.equal(error.message,'dstat/null event ignored.','error is not equal');
      });
    });
  });

  describe('#generic recover event',function() {
    it('should return the error: [Error: dstat/null event ignored.]', function() {
      notifications(dstat,null,events[4].data,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.equal(error.message,'dstat/null event ignored.','error is not equal');
      });
    });
  });
});

describe('Script Monitor',function() {
  describe('#failure event',function() {
    it('should return a failure alert subject/content', function() {
      notifications(script,Constants.RESOURCE_FAILURE,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*failure$/,'the subject does not match');
      });
    });
  });

  describe('#recover from failure event',function() {
    it('should return a recover alert subject/content', function() {
      notifications(script,Constants.RESOURCE_NORMAL,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*recovered/,'the subject does not match');
      });
    });
  });

  describe('#undefined/null/no event',function() {
    it('should return an error alert subject/content', function() {
      notifications(script,null,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*error/,'the subject does not match');
      });
    });
  });

  describe('#not handled ERROR event',function() {
    it('should return an error alert subject/content', function() {
      notifications(script,'ERROR',{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*error/,'the subject does not match');
      });
    });
  });

  describe('#stopped event',function() {
    it('should return an unreachable alert subject/content', function() {
      notifications(script,Constants.RESOURCE_STOPPED,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable$/,'the subject does not match');
      });
    });
  });

  describe('#recover from stopped event',function() {
    it('should return a recover from stopped alert subject/content', function() {
      notifications(script,Constants.RESOURCE_RECOVERED,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*recovered$/,'the subject does not match');
      });
    });
  });
});

describe('Host Monitor',function() {
  describe('#agent stopped event',function() {
    it('should return a unreachable alert subject/content', function() {
      var resource = {
        'description':'dracolagoon.com',
        'hostname':'dracolagoon.com',
        'type':'host',
      };
      notifications(resource,Constants.AGENT_STOPPED,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable/,'the subject does not match');
      });
    });
  });

  describe('#host stopped event',function() {
    it('should return a unreachable alert subject/content', function() {
      var resource = {
        'description':'dracolagoon.com',
        'hostname':'dracolagoon.com',
        'type':'host',
      };
      notifications(resource,Constants.RESOURCE_STOPPED,{},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable/,'the subject does not match');
      });
    });
  });
});

describe('Fake Monitor/Error',function() {
  describe('#wrog type',function() {
    it('should return an error and no specs', function() {
      var resource = {
        type:'wrong',
        hostname:'unknown',
        name:'batata resource',
      };
      notifications(resource,null,events[0].data,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.match(error.message,/resource type.*invalid or not defined/,'error is not equal');
        assert.isNull(specs,'specs should be null');
      });
    });
  });
});



describe('Scraper Monitor',function() {
  var events = [
    'ERROR',
    'scraper.request.error',
    'scraper.status_code.invalid_regexp',
    'scraper.status_code.not_match',
    'scraper.pattern.invalid_regexp',
    'scraper.pattern.match',
    'scraper.pattern.not_match'
  ];

  var errorEvent = events[Math.floor(Math.random() * events.length)];
  describe('#random ERROR event',function() {
    it('should return an error alert subject/content', function() {
      notifications(script,errorEvent,{event:errorEvent},(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*error/,'the subject does not match');
      });
    });
  });

});
