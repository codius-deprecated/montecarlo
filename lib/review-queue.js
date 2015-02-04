var bluebird = require('bluebird');
var reviewer = require('./reviewer');
var config = require('../config');
var reviewers = require('./reviewers');

module.exports.PullRequestQueue = function(queue, github, trackerProject) {
  this.queue = queue;
  this.github = github;
  this.trackerProject = trackerProject;
}

module.exports.PullRequestQueue.prototype = {
  enqueuePullRequest: function(user, repo, number) {
    var self = this;
    return new bluebird.Promise(function(resolve, reject) {
      self.queue.create('pull-requests', {
        user: user,
        repo: repo,
        number: number
      }).save(function(err) {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  },
  processNextPullRequest: function() {
    var self = this;
    return new bluebird.Promise(function(resolve, reject) {
      self.queue.process('pull-requests', function(job, done) {
        var r = new reviewer.PullRequestReviewer(self.github, job.data.user, job.data.repo);
        r.addProcessor(new reviewers.LGTMProcessor(r, config.lgtmThreshold));
        r.addProcessor(new reviewers.TrackerProcessor(self.trackerProject, r));
        if (job.data.number > -1) {
          console.log("Processing %s/%s/%d", job.data.user, job.data.repo, job.data.number);
          resolve(r.reviewOne(job.data.number).then(done, done));
        } else {
          console.log("Processing %s/%s/*", job.data.user, job.data.repo);
          resolve(r.reviewAll().then(done, done));
        }
      });
    });
  }
}
