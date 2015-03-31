var winston = require('./winston');
var bluebird = require('bluebird');
var moment = require('moment');
var warlock = require('./warlock');
var check = require('check-types');

module.exports.PullRequestReviewer = function(github, user, repo, redis) {
  check.assert.object(github);
  check.assert.string(user);
  check.assert.string(repo);
  check.assert.object(redis);

  this.repo = repo;
  this.user = user;
  this.github = github;
  this.processors = [];
  this.redis = redis;
}

module.exports.PullRequestReviewer.prototype = {
  setMeta: function(pr, key, value) {
    check.assert.object(pr);
    check.assert.number(pr.id);
    var self = this;
    return self.redis.saddAsync('pull-requests', pr.id).then(function() {
      if (typeof(value) != "undefined") {
        check.assert.string(key);
        return self.redis.hsetAsync('pr:'+pr.id, key, value);
      } else {
        check.assert.object(key);
        Object.keys(key).forEach
        return self.redis.hmsetAsync('pr:'+pr.id, key);
      }
    });
  },
  reviewAll: function(state) {
    check.assert.string(state);
    var _state = state || 'open';
    return this.reviewAllPRs(_state, 1);
  },
  reviewOne: function(number) {
    check.assert.number(number);
    var self = this;
    return self.getPullRequest(number).then(function(pr) {
      return self.reviewOnePR(pr);
    });
  },
  getPullRequest: function(number) {
    check.assert.number(number);
    var self = this;
    return self.github.pullRequests.getAsync({
      repo: self.repo,
      user: self.user,
      number: number
    });
  },
  addProcessor: function(processor) {
    check.assert.object(processor);
    this.processors.push(processor);
  },
  getPRLock: function(pr) {
    check.assert.object(pr);
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
    check.assert.object(pr);
    var self = this;
    return bluebird.using(self.getPRLock(pr), function(locked) {
      if (locked) {
        var p = [];
        winston.debug("Reviewing %s/%s/%d", self.user, self.repo, pr.number);
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
    check.assert.string(state);
    check.assert.number(page);
    var self = this;
    var allIDs = [];
    return self.github.pullRequests.getAllAsync({
      repo: self.repo,
      user: self.user,
      state: state,
      per_page: 100,
      page: page
    }).then(function(prs) {
      winston.debug("Found %d PRs on page %d for %s/%s", prs.length, page, self.repo, self.user);
      if (prs.length > 0) {
        var p = [];
        prs.forEach(function(pr) {
          p.push(self.reviewOnePR(pr));
        });
        if (prs.length == 100) {
          p.push(self.reviewAllPRs(state, page + 1));
        }
        return bluebird.all(p);
      }
    });
  }
};
