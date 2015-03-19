var bluebird = require('bluebird');
var moment = require('moment');
var warlock = require('./warlock');
var check = require('check-types');

module.exports.PullRequestReviewer = function(github, user, repo, redis) {
  check.object(github);
  check.string(user);
  check.string(repo);
  check.object(redis);

  this.repo = repo;
  this.user = user;
  this.github = github;
  this.processors = [];
  this.redis = redis;
}

module.exports.PullRequestReviewer.prototype = {
  setMeta: function(pr, key, value) {
    check.object(pr);
    var self = this;
    return self.redis.saddAsync('pull-requests', pr.id).then(function() {
      if (typeof(value) != "undefined") {
        check.string(key);
        return self.redis.hsetAsync('pr:'+pr.id, key, value);
      } else {
        check.object(key);
        return self.redis.hmsetAsync('pr:'+pr.id, key);
      }
    });
  },
  reviewAll: function(state) {
    check.string(state);
    var _state = state || 'open';
    return this.reviewAllPRs(_state, 1);
  },
  reviewOne: function(number) {
    check.number(number);
    var self = this;
    return self.getPullRequest(number).then(function(pr) {
      return self.reviewOnePR(pr);
    });
  },
  getPullRequest: function(number) {
    check.number(number);
    var self = this;
    return self.github.pullRequests.getAsync({
      repo: self.repo,
      user: self.user,
      number: number
    });
  },
  addProcessor: function(processor) {
    check.object(processor);
    this.processors.push(processor);
  },
  getPRLock: function(pr) {
    check.object(pr);
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
    check.object(pr);
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
    check.string(state);
    check.number(page);
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
