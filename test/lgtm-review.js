var config = require('../config');
var reviewer = require('../lib/reviewer');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var expect = chai.expect;
var replay = require('replay');
var sinon = require('sinon');
var bluebird = require('bluebird');
var sinonAsPromised = require('sinon-as-promised')(bluebird.Promise);
var lgtm = require('../lib/reviewers/lgtm');
var tracker = require('../lib/reviewers/tracker');
var fx = require('node-fixtures');
var labelClass = require('pivotaltracker/lib/resources/label').Service;
var storyClass = require('pivotaltracker/lib/resources/story').Service;
var commentClass = require('pivotaltracker/lib/resources/comment').Service;
var PullRequestQueue = require('../lib/review-queue').PullRequestQueue;

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

sinon.stub(config.github.pullRequests, "mergeAsync").resolves([]);
sinon.stub(config.redis, "hset", function(){});
sinon.stub(config.redis, "hsetAsync").resolves([]);
sinon.stub(config.redis, "sremAsync").resolves([]);
sinon.stub(config.github.pullRequests, "getAllAsync", singlePage(fx.pullRequests, []));
sinon.stub(config.github.pullRequests, "getCommitsAsync", singlePage(fx.commits, []));
sinon.stub(config.github.statuses, "getCombinedAsync", singlePage(fx.statuses, {statuses: []}));
sinon.stub(config.github.issues, "getCommentsAsync", singlePage(fx.comments, []));
sinon.stub(config.github.issues, "createCommentAsync").resolves([]);
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
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  r.addProcessor(proc);
  expect(r.reviewAll()).to.be.fulfilled.then(function() {
    expect(proc.seen_ids).to.deep.equal([1, 2]);
  }).then(done, function(e) {done(e);});
});

it('correctly confirms a successful build', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(config.github, r, 1);
  expect(proc.getBuildStatus(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v).to.equal(true);
  }).then(done);
});

it('correctly counts a number of LGTMs', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(config.github, r, 1);
  expect(proc.getLGTMs(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v.length).to.equal(3);
  }).then(done);
});

it('merges a valid pull request', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proc = new lgtm.LGTMProcessor(config.github, r, 1);
  sinon.spy(proc, "mergePR");
  expect(proc.review(fx.pullRequests[0])).to.be.fulfilled.then(function() {
    expect(proc.mergePR.called).to.equal(true);
  }).then(done);
});

it('extracts a set of tracker story IDs', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proj = config.pivotal.project(0);
  var proc = new tracker.TrackerProcessor(proj, r, 1);
  expect(proc.getTrackerStories(fx.pullRequests[0], 1)).to.be.fulfilled.then(function(v) {
    expect(v).to.deep.equal([1]);
  }).then(done);
});

it('marks an item as delivered when a PR is created', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proj = config.pivotal.project(1);
  var proc = new tracker.TrackerProcessor(proj, r, 1);
  sinon.spy(proc, "markStoryDelivered");
  expect(proc.review(fx.pullRequests[0])).to.be.fulfilled.then(function() {
    expect(proc.markStoryDelivered.called).to.equal(true);
  }).then(done);
});

it('marks an item as accepted when a PR is merged', function(done) {
  var r = new reviewer.PullRequestReviewer(config.github, 'codius', 'codius-sandbox-core');
  var proj = config.pivotal.project(1);
  var proc = new tracker.TrackerProcessor(proj, r, 1);
  sinon.spy(proc, "markStoryAccepted");
  expect(proc.review(fx.pullRequests[1])).to.be.fulfilled.then(function() {
    expect(proc.markStoryAccepted.called).to.equal(true);
  }).then(done);
});

it('processes an item from the job queue without crashing', function(done) {
  var queue = new PullRequestQueue(config.queue, config.github, config.pivotal.project(1));
  queue.enqueuePullRequest('codius', 'codius-sandbox-core', 1);
  expect(queue.processNextPullRequest()).to.notify(done);
});
