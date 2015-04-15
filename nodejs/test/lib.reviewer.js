var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var expect = require('chai').expect;
var lgtm = require('../lib/reviewers/lgtm');
var github = require('../lib/github');
var redis = require('../lib/redis');
var PullRequestReviewer = require('../lib/reviewer').PullRequestReviewer;

var MockProcessor = function() {
  this.seen_ids = [];
};

MockProcessor.prototype = {
  review: function(pr) {
    this.seen_ids.push(pr.id);
  }
};

describe('PullRequestReviewer', function() {
  var r;

  beforeEach(function() {
    r = new PullRequestReviewer(github, 'codius', 'codius-host', redis);
    return redis.delAsync('pull-requests');
  });

  after(function() {
    return redis.smembersAsync('pull-requests').map(Number).each(function(id) {
      return redis.delAsync('pr:'+id);
    }).then(function() {
      return redis.delAsync('pull-requests');
    });
  });

  describe('#reviewAll', function() {
    it('reviews a list of pull requests', function() {
      var proc = new MockProcessor();
      r.addProcessor(proc);
      return expect(r.reviewAll('all')).to.be.fulfilled.then(function() {
        expect(proc.seen_ids).to.deep.equal([
          30133738, 30129873, 30019150, 29953807, 29953802, 29951794, 29944414,
          29835251, 29574492, 29562329, 29477958, 29329038, 29328845, 29311458,
          29293637, 29215379, 29203744, 29045930, 28967175, 28855010, 28688718,
          28599503, 28243156, 28239090, 28237489, 28234709, 28130880, 28052374,
          27889886, 27796241, 27546824, 27396449, 27197892, 27130859, 27068571,
          27067652, 26246091, 19262745, 19257943
        ]);
      });
    });
  });

  describe('#setMeta', function() {
    it('adds an item to the request list', function() {
      return r.setMeta({id: 1}, 'foo', 'bar').then(function() {
        return redis.smembersAsync('pull-requests').map(Number);
      }).then(function(ids) {
        expect(ids).to.deep.equal([1]);
      });
    });

    it('adds several items to the request list', function() {
      var p = [];
      for (i = 0; i < 100; i++) { 
        p.push(r.setMeta({id: i}, 'foo', i));
      };
      return bluebird.all(p).then(function() {
        return redis.smembersAsync('pull-requests').map(Number);
      }).then(function(ids) {
        expect(ids).to.have.length(100);
        expect(ids).to.contain(42);
      });
    });

    it('sets a metadata value', function() {
      return r.setMeta({id: 1}, 'foo', 'bar').then(function() {
        return redis.smembersAsync('pull-requests').map(Number);
      }).then(function(ids) {
        return redis.hgetallAsync('pr:'+ids[0])
      }).then(function(meta) {
        expect(meta).to.have.property('foo');
        expect(meta.foo).to.equal('bar');
      });
    });

    it('sets a metadata value from a hash', function() {
      return r.setMeta({id: 1}, {foo: 'bar'}).then(function() {
        return redis.smembersAsync('pull-requests').map(Number);
      }).then(function(ids) {
        return redis.hgetallAsync('pr:'+ids[0])
      }).then(function(meta) {
        expect(meta).to.have.property('foo');
        expect(meta.foo).to.equal('bar');
      });
    });
  });
});
