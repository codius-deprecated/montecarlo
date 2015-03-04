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
    return self.getPullRequest(number).then(function(pr) {
      return self.reviewOnePR(pr);
    });
  },
  getPullRequest: function(number) {
    var self = this;
    return self.github.pullRequests.getAsync({
      repo: self.repo,
      user: self.user,
      number: number
    });
  },
  addProcessor: function(processor) {
    this.processors.push(processor);
  },
  getPRLock: function(pr) {
    var self = this;
    return warlock.lockAsync('pr-lock' + pr.id, 5000) // 5s TTL
      .then(function(unlock) {
        if (typeof unlock === 'function') {
          return true;
        }
        return false;
      })
      .disposer(function(unlock) {
        if (typeof unlock === 'function') {
          unlock();
        }
      });
  },
  reviewOnePR: function(pr) {
    var self = this;
    return bluebird.using(self.getPRLock(pr), function(locked) {
      if (locked) {
        var p = [];
        console.log("Reviewing %s/%s/%d", self.user, self.repo, pr.number);
        self.processors.forEach(function(processor) {
          p.push(processor.review(pr));
        });
        return bluebird.all(p);
      } else {
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
