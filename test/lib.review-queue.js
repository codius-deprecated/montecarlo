var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var PullRequestQueue = require('../lib/review-queue').PullRequestQueue;
var expect = require('chai').expect;
var kue = require('../lib/kue');
var github = require('../lib/github');

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
    var queue = new PullRequestQueue(kue, github, null);
    queue.addReviewerFactory(TestFactory);
    queue.enqueuePullRequest('codius', 'codius-sandbox-core', 1);
    expect(queue.processNextPullRequest()
      .then(function() {
        expect(seenRequests).to.deep.equal([]);
    })).to.notify(done);
  });
});
