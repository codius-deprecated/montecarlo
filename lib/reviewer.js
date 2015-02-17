var bluebird = require('bluebird');
var moment = require('moment');
var warlock = require('./warlock');

module.exports.PullRequestReviewer = function(github, user, repo) {
  this.repo = repo;
  this.user = user;
  this.github = github;
  this.processors = [];
}

module.exports.PullRequestReviewer.prototype = {
  reviewAll: function(state) {
    var _state = state || 'open';
    return this.reviewAllPRs(_state, 1);
  },
  reviewOne: function(number) {
    var self = this;
    return self.github.pullRequests.getAsync({
      repo: self.repo,
      user: self.user,
      number: number
    }).then(function(pr) {
      return this.reviewOnePR(pr);
    });
  },
  addProcessor: function(processor) {
    this.processors.push(processor);
  },
  reviewOnePR: function(pr) {
    var self = this;
    return warlock.lockAsync('pr-lock' + pr.id, 10000).then(function(unlock) { // 10s TTL
      if (typeof unlock === 'function') {
        var p = [];
        self.processors.forEach(function(processor) {
          console.log("Reviewing %s/%s/%d with %s", self.user, self.repo, pr.number, processor);
          p.push(processor.review(pr));
        });
        return bluebird.all(p).then(function() {
          unlock();
        });
      } else {
        console.log("There is already a lock on %d", pr.id);
        return [];
      }
    });
  },
  reviewAllPRs: function(state, page) {
    var self = this;
    var allIDs = [];
    return self.github.pullRequests.getAllAsync({
      repo: self.repo,
      user: self.user,
      state: state,
      per_page: 100,
      page: page
    }).then(function(prs) {
      if (prs.length > 0) {
        var p = [];
        prs.forEach(function(pr) {
          p.push(self.reviewOnePR(pr));
        });
        if (prs.length == 100) {
          p.push(self.reviewAllPRs(page + 1));
        }
        return bluebird.all(p);
      }
    });
  }
};
