var trackerClient = require('../lib/tracker');
var nconf = require('../lib/config');
var reviewer = require('../lib/reviewer');
var bluebird = require('bluebird');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var expect = chai.expect;
var replay = require('replay');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised')(bluebird.Promise);
var lgtm = require('../lib/reviewers/lgtm');
var tracker = require('../lib/reviewers/tracker');
var fx = require('node-fixtures');
var labelClass = require('pivotaltracker/lib/resources/label').Service;
var storyClass = require('pivotaltracker/lib/resources/story').Service;
var commentClass = require('pivotaltracker/lib/resources/comment').Service;
var PullRequestQueue = require('../lib/review-queue').PullRequestQueue;

var github = require('../lib/github');
var redis = require('../lib/redis');
var kue = require('../lib/kue');

chai.use(chaiAsPromised);

function singlePage(data, empty) {
  return function(args) {
    return new bluebird.Promise(function(resolve, reject) {
      if (args.page == "undefined" || args.page == 1) {
        resolve(data);
      } else {
        resolve(empty);
      }
    });
  }
}

sinon.stub(github.pullRequests, "mergeAsync").resolves([]);
sinon.stub(redis, "hset", function(){});
sinon.stub(redis, "hsetAsync").resolves([]);
sinon.stub(redis, "sremAsync").resolves([]);
sinon.stub(github.pullRequests, "getAllAsync", singlePage(fx.pullRequests, []));
sinon.stub(github.pullRequests, "getCommitsAsync", singlePage(fx.commits, []));
sinon.stub(github.pullRequests, "getMergedAsync").resolves(true);
sinon.stub(github.statuses, "getCombinedAsync", singlePage(fx.statuses, {statuses: []}));
sinon.stub(github.issues, "getCommentsAsync", singlePage(fx.comments, []));
sinon.stub(github.issues, "createCommentAsync").resolves([]);
sinon.stub(github.issues, "getRepoIssueAsync").resolves({body: '+r'});
sinon.stub(storyClass.prototype, "getAsync").resolves(fx.story);
sinon.stub(storyClass.prototype, "updateAsync").resolves([]);
sinon.stub(commentClass.prototype, "createAsync").resolves([]);
sinon.stub(labelClass.prototype, "allAsync").resolves(fx.labels);
sinon.stub(labelClass.prototype, "createAsync", function(args) {
  return new bluebird.Promise(function(resolve, reject) {
    resolve(args);
  });
});

var MockProcessor = function() {
  this.seen_ids = [];
};

MockProcessor.prototype = {
  review: function(pr) {
    this.seen_ids.push(pr.id);
  }
};

it('processes a list of pull requests', function(done) {
  var proc = new MockProcessor();
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  r.addProcessor(proc);
  expect(expect(r.reviewAll()).to.be.fulfilled.then(function() {
    expect(proc.seen_ids).to.deep.equal([1, 2]);
  })).to.notify(done);
});

it('correctly confirms a successful build', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(r, 1);
  expect(expect(proc.getBuildStatus(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v).to.equal(true);
  })).to.notify(done);
});

it('correctly counts a number of LGTMs', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(r, 1);
  expect(expect(proc.getCommands(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v.lgtm.length).to.equal(3);
  })).to.notify(done);
});

it('merges a valid pull request', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(r, 1);
  sinon.spy(proc, "mergePR");
  expect(expect(proc.review(fx.pullRequests[0])).to.be.fulfilled.then(function() {
    expect(proc.mergePR.called).to.equal(true);
  })).to.notify(done);
});

it('extracts a set of tracker story IDs', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proj = trackerClient.project(0);
  var proc = new tracker.TrackerProcessor(r, proj);
  expect(expect(proc.getTrackerStories(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v).to.deep.equal([1]);
  })).to.notify(done);
});

it('marks an item as in review when a PR is created', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proj = trackerClient.project(1);
  var proc = new tracker.TrackerProcessor(r, proj);
  sinon.spy(proc, "markStoryInReview");
  expect(expect(proc.review(fx.pullRequests[0])).to.be.fulfilled.then(function() {
    expect(proc.markStoryInReview.called).to.equal(true);
  })).to.notify(done);
});

it('marks an item as delivered when a PR is merged', function(done) {
  var r = new reviewer.PullRequestReviewer(github, 'codius', 'codius-sandbox-core');
  var proj = trackerClient.project(1);
  var proc = new tracker.TrackerProcessor(r, proj);
  sinon.spy(proc, "markStoryDelivered");
  sinon.spy(proc, "updateTracker");
  expect(expect(proc.review(fx.pullRequests[1])).to.be.fulfilled.then(function() {
    expect(proc.updateTracker.called).to.equal(true);
    expect(proc.markStoryDelivered.called).to.equal(true);
  })).to.notify(done);
});

it('processes an item from the job queue without crashing', function(done) {
  var queue = new PullRequestQueue(kue, github, trackerClient.project(1));
  queue.enqueuePullRequest('codius', 'codius-sandbox-core', 1);
  expect(queue.processNextPullRequest()).to.notify(done);
});

it('parses a bunch of commands', function(done) {
  var proc = new lgtm.LGTMProcessor(null, 1);
  expect(proc.parseCommands(fx.comments[4].body)).to.deep.equal([[], ['retry']]);
  done();
});
