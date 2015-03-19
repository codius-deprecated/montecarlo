var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var PullRequestQueue = require('../lib/review-queue').PullRequestQueue;
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var kue = require('../lib/kue');
var github = require('../lib/github');
var redis = require('../lib/redis');

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('PullRequestQueue', function() {
  var seenRequests = [];

  function TestFactory(reviewer) {
    this.reviewer = reviewer;
  }

  TestFactory.prototype = {
    review: function(pr) {
      seenRequests.push(pr);
    }
  }

  beforeEach(function() {
    seenRequests = [];
  });

  it('processes an item from the job queue without crashing', function(done) {
    var queue = new PullRequestQueue(kue, github, redis);
    queue.addReviewerFactory(function(f) {return new TestFactory(f)});
    queue.enqueuePullRequest('codius', 'codius-sandbox-core', 1);
    expect(queue.processNextPullRequest()
      .then(function() {
        expect(seenRequests).to.have.length(1);
        expect(seenRequests[0]).to.contain.keys('head', 'base');
    })).to.notify(done);
  });
});
