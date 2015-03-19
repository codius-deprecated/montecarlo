var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised')(bluebird.Promise);
var tracker = require('../lib/reviewers/tracker');
var github = require('../lib/github');
var redis = require('../lib/redis');
var labelClass = require('pivotaltracker/lib/resources/label').Service;
var storyClass = require('pivotaltracker/lib/resources/story').Service;
var commentClass = require('pivotaltracker/lib/resources/comment').Service;
var trackerClient = require('../lib/tracker');
var PullRequestReviewer = require('../lib/reviewer').PullRequestReviewer;

var expect = chai.expect;
chai.use(chaiAsPromised);

describe('TrackerProcessor', function() {
  var proc, reviewer, proj;

  before(function() {
    sinon.stub(storyClass.prototype, "updateAsync").resolves([]);
    sinon.stub(commentClass.prototype, "createAsync").resolves([]);
    sinon.stub(labelClass.prototype, "createAsync", function(args) {
      return new bluebird.Promise(function(resolve, reject) {
        resolve(args);
      });
    });
  });

  beforeEach(function() {
    reviewer = new PullRequestReviewer(github, 'codius', 'codius-host', redis);
    proj = trackerClient.project(1);
    proc = new tracker.TrackerProcessor(reviewer, proj);
  });

  describe('#getTrackerStories', function() {
    it('extracts no stories', function() {
      return reviewer.getPullRequest(1).then(function(pr) {
        return expect(proc.getTrackerStories(pr)).to.eventually.deep.equal([]);
      });
    });

    it('extracts a single story', function() {
      return reviewer.getPullRequest(38).then(function(pr) {
        return expect(proc.getTrackerStories(pr)).to.eventually.deep.equal([88832248]);
      });
    });

    it('extracts a set of stories from multiple commits', function() {
      return reviewer.getPullRequest(37).then(function(pr) {
        return expect(proc.getTrackerStories(pr)).to.eventually.deep.equal([
            88810646, 88802586, 89063046, 89049566, 89122456
        ]);
      });
    });

    it('extracts multiple stories from a series of commits with multiple stories tagged in each commit', function() {
      return reviewer.getPullRequest(34).then(function(pr) {
        return expect(proc.getTrackerStories(pr)).to.eventually.deep.equal([
            88106292, 87231924, 88278714, 88629218
        ]);
      });
    });
  });

  describe('#markStoryInReview', function() {

    it('marks an item as in review when a PR is tagged with +r', function() {
      sinon.stub(proc, "markStoryInReview").resolves(true);
      sinon.stub(proc, "getReviewLabel").resolves({name: 'needs-review'});
      return reviewer.getPullRequest(38).then(function(pr) {
        pr.state = "open";
        return proc.review(pr);
      }).then(function() {
        expect(proc.markStoryInReview.called).to.equal(true);
      });
    });

    it('marks an item as delivered when a PR is merged', function() {
      sinon.spy(proc, "markStoryDelivered");
      sinon.stub(storyClass.prototype, "getAsync").resolves([]);
      return reviewer.getPullRequest(38).then(function(pr) {
        return proc.review(pr);
      }).then(function() {
        expect(proc.markStoryDelivered.called).to.equal(true);
      });
    });
  });
});
