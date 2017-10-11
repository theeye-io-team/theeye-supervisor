'use strict'

const assert = require('chai').assert
const notifications = require('../core/service/resource/notifications')
const CONSTANTS = require('../core/constants/monitors')

const script = {
  name: 'script monitor',
  description: 'script monitor',
  hostname: 'dracolagoon.com',
  type: 'script',
  state: ''
}
const dstat = {
  name: 'dstat monitor',
  description: 'dstat monitor',
  hostname: 'dracolagoon.com',
  type: 'dstat',
  state: ''
}
const events = [
  {name:'host:stats:cpu:high',data:{cpu:90}},
  {name:'host:stats:mem:high',data:{mem:'90'}},
  {name:'host:stats:cache:high',data:{cache:'90'}},
  {name:'host:stats:disk:high',data:undefined},
  {name:'host:stats:normal',data:undefined},
]

describe('Dstat Monitor',function() {
  describe('#failure event',function() {
    it('should return an alert subject with LOW tag', function() {
      var failure = events[1];
      let options = {
        resource: dstat,
        event: failure.name,
        data: failure.data,
        failure_severity: 'LOW'
      }
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.notMatch(specs.subject,/^[LOW].*alert/,'the subject does not match');
      });
    });
  });

  describe('#recover event',function() {
    it('should return a STATS recovered subject with LOW tag', function() {
      var recover = events[4];
      let options = {
        resource: dstat,
        event: recover.name,
        data: recover.data,
        failure_severity: 'LOW'
      }
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.notMatch(specs.subject,/^[LOW].*STATS recovered$/,'the subject does not match');
      });
    });
  });

  describe('#null event name',function() {
    it('should return the error: [Error: dstat/null event ignored.]', function() {
      var failure = events[0];
      let options = {
        resource: dstat,
        event: null,
        data: failure.data,
        failure_severity: 'LOW'
      }
      notifications(options,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.equal(error.message,'dstat/null event ignored.','error is not equal');
      });
    });
  });

  describe('#undefined event name & event data',function() {
    it('should return the error: [Error: dstat/null event ignored.]', function() {
      var failure = events[0];
      let options = {
        resource: dstat,
        event: undefined,
        data: undefined,
        failure_severity: 'LOW'
      }
      notifications(options,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.equal(error.message,'dstat/null event ignored.','error is not equal');
      });
    });
  });


  describe('#generic recover event',function() {
    it('should return the error: [Error: dstat/null event ignored.]', function() {
      let options = {
        resource: dstat,
        event: null,
        data: events[4].data,
        failure_severity: 'LOW'
      }
      notifications(options,(error,specs) => {
        assert.instanceOf(error,Error,'error should be an Error');
        assert.equal(error.message,'dstat/null event ignored.','error is not equal');
      });
    });
  });
});

describe('Script Monitor',function() {
  describe('#1 failure: event',function() {
    let options = {
      resource: script,
      event: CONSTANTS.RESOURCE_FAILURE,
      data: undefined,
      failure_severity: 'HIGH'
    }
    it('should return a failure alert subject/content', function() {
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*failure$/,'the subject does not match');
      });
    });
  });

  describe('#2 failure: undefined/null/no event',function() {
    let options = {
      resource: script,
      event: null,
      data: undefined,
      failure_severity: 'HIGH'
    }
    it('should return a failure alert subject/content', function() {
      notifications(options,(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*failure/,'the subject does not match');
      });
    });
  });

  describe('#3 failure: not handled ERROR event',function() {
    let options = {
      resource: script,
      event: 'ERROR',
      data: undefined,
      failure_severity: 'HIGH'
    }
    it('should return a failure alert subject/content', function() {
      notifications(options,(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*failure/,'the subject does not match');
      });
    });
  });

  describe('#recover from failure event',function() {
    let resource = Object.assign({},script,{state:CONSTANTS.RESOURCE_RECOVERED})
    let options = {
      resource: resource,
      //event: CONSTANTS.RESOURCE_NORMAL,
      event: undefined,
      data: undefined,
      failure_severity: 'HIGH'
    }
    it('should return a recovery alert subject/content', function() {
      notifications(options,(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*recovered/,'the subject does not match');
      });
    });
  });

  describe('#stopped event',function() {
    let resource = Object.assign({},script,{state:CONSTANTS.RESOURCE_STOPPED})
    let options = {
      resource: resource,
      //event: CONSTANTS.RESOURCE_NORMAL,
      event: undefined,
      data: undefined,
      failure_severity: 'HIGH'
    }
    it('should return an unreachable alert subject/content', function() {
      notifications(options,(error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable$/,'the subject does not match');
      });
    });
  });
})

describe('Host Monitor',function() {
  describe('#agent stopped event',function() {
    it('should return a unreachable alert subject/content', function() {
      let options = {
        resource: {
          description: 'dracolagoon.com',
          hostname: 'dracolagoon.com',
          type: 'host',
          state: CONSTANTS.AGENT_STOPPED
        },
        failure_severity: 'HIGH'
      }
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable/,'the subject does not match');
      });
    });
  });

  describe('#host stopped event',function() {
    it('should return a unreachable alert subject/content', function() {
      let options = {
        resource: {
          description: 'dracolagoon.com',
          hostname: 'dracolagoon.com',
          type: 'host',
          state: CONSTANTS.RESOURCE_STOPPED
        },
        failure_severity: 'HIGH'
      }
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*unreachable/,'the subject does not match');
      });
    });
  });
});

describe('Fake Monitor/Error',function() {
  describe('#wrong type/state/specs',function() {
    let options = {
      resource: {
        type:'wrong',
        hostname:'unknown',
        name:'batata resource',
        state: null
      },
      failure_severity: 'HIGH'
    }
    it('should return an error and no specs', function() {
      notifications(options, (error,specs) => {
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

  var errorEvent = events[Math.floor(Math.random() * events.length)]
  describe('#random ERROR event',function() {
    let options = {
      resource: script,
      event: errorEvent,
      data: {event:errorEvent},
      failure_severity: 'HIGH'
    }

    it('should return an failure alert subject/content', function() {
      notifications(options, (error,specs) => {
        assert.ifError(error);
        assert.instanceOf(specs,Object,'specs should be an Object');
        assert.match(specs.subject,/^\[HIGH\].*failure/,'the subject does not match');
      });
    });
  });

});
