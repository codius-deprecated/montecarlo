var bluebird = require('bluebird');
var moment = require('moment');

module.exports.PullRequestReviewer = function(redis, github, user, repo) {
  this.redis = redis;
  this.repo = repo;
  this.user = user;
  this.github = github;
  this.processors = [];
}

module.exports.PullRequestReviewer.prototype = {
  reviewAll: function() {
    this.redis.hset("crawl-state", "last-run", moment());
    return this.getPullRequests(1);
  },
  addProcessor: function(processor) {
    this.processors.push(processor);
  },
  getPullRequests: function(page) {
    var self = this;
    var allIDs = [];
    return self.github.pullRequests.getAllAsync({
      repo: self.repo,
      user: self.user,
      state: 'open',
      per_page: 100,
      page: page
    }).then(function(prs) {
      if (prs.length > 0) {
        var p = [];
        prs.forEach(function(pr) {
          self.redis.sadd("pull-requests", JSON.stringify({user: self.user, repo: self.repo, number: pr.number}));
          self.processors.forEach(function(processor) {
            p.push(processor.review(pr));
          });
        });
        if (prs.length == 100) {
          p.push(self.getPullRequests(page + 1));
        }
        return bluebird.all(p);
      }
    });
  }
};
