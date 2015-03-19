var bluebird = require('bluebird');
var reviewer = require('./reviewer');
var reviewers = require('./reviewers');
var check = require('check-types');

module.exports.PullRequestQueue = function(queue, github, redis) {
  check.assert.object(queue);
  check.assert.object(github);
  check.assert.object(redis);
  this.queue = queue;
  this.github = github;
  this.reviewFactories = [];
  this.redis = redis;
}

module.exports.PullRequestQueue.prototype = {
  enqueuePullRequest: function(user, repo, number) {
    check.assert.number(number);
    check.assert.string(user);
    check.assert.string(repo);

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
    check.assert.function(f);
    var self = this;
    self.reviewFactories.push(f);
  },
  processNextPullRequest: function() {
    var self = this;
    return new bluebird.Promise(function(resolve, reject) {
      self.queue.process('pull-requests', function(job, done) {
        var r = new reviewer.PullRequestReviewer(self.github, job.data.user, job.data.repo, self.redis);
        self.reviewFactories.forEach(function(f) {
          r.addProcessor(f(r));
        });
        if (job.data.number == -1) {
          return r.reviewAll('all').then(function(v) {
            resolve(v);
            done(v);
          }).catch(function(e) {
            reject(e);
            done(e);
          });
        } else {
          return r.reviewOne(job.data.number).then(function(v) {
            resolve(v);
            done(v);
          }).catch(function(e) {
            reject(e);
            done(e);
          });
        }
      });
    });
  }
}
