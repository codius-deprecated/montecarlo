var bluebird = require('bluebird');
var reviewer = require('./reviewer');
var config = require('../config');
var reviewers = require('./reviewers');

module.exports.PullRequestQueue = function(queue, github) {
  this.queue = queue;
  this.github = github;
  this.reviewFactories = [];
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
  addReviewerFactory: function(f) {
    var self = this;
    self.reviewFactories.push(f);
  },
  processNextPullRequest: function() {
    var self = this;
    return new bluebird.Promise(function(resolve, reject) {
      self.queue.process('pull-requests', function(job, done) {
        var r = new reviewer.PullRequestReviewer(self.github, job.data.user, job.data.repo);
        self.reviewFactories.forEach(function(f) {
          r.addProcessor(f(r));
        });
        if (job.data.number == -1) {
          resolve(r.reviewAll('all').then(done, done));
        } else {
          resolve(r.reviewOne(job.data.number).then(done, done));
        }
      });
    });
  }
}
