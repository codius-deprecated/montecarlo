var format = require('string-template');
var bluebird = require('bluebird');

module.exports.LGTMProcessor = function(github, reviewer, lgtmThreshold) {
  this.github = github;
  this.reviewer = reviewer;
  this.threshold = lgtmThreshold;
}

module.exports.LGTMProcessor.prototype = {
  review: function(pr) {
    var self = this;
    return bluebird.join(
      self.getBuildStatus(pr, 1),
      self.getLGTMs(pr, 1),
      pr,
      self.checkAndMergePR.bind(self));
  },

  getBuildStatus: function(pr, page) {
    var self = this;
    return self.github.pullRequests.getCommitsAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number,
      per_page: 1,
      page: page
    }).then(function(commits) {
      var p = [];
      if (commits.length > 0) {
        commits.forEach(function(commit) {
          p.push(self.github.statuses.getCombinedAsync({
            user: self.reviewer.user,
            repo: self.reviewer.repo,
            sha: commit.sha
          }).then(function(combined) {
            var st = true;
            combined.statuses.forEach(function(s) {
              if (s.context == "continuous-integration/travis-ci" && s.state != "success") {
                st = false;
              }
            });
            return st;
          }));
        });
      }
      return bluebird.reduce(p, function(a, b) {return a && b;}, true).then(function(st) {
        if (commits.length == 100 && st) {
          return self.getBuildStatus(pr, page + 1);
        } else {
          return st;
        }
      });
    });
  },

  mergePR: function(lgtms, pr) {
    var self = this;
    var comment = self.buildComment(lgtms);
    var commitMsg = self.buildCommitMessage(lgtms);
    return self.github.issues.createCommentAsync({
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      number: pr.number,
      body: comment
    }).then(function() {
      return self.github.pullRequests.mergeAsync({
        user: self.reviewer.user,
        repo: self.reviewer.repo,
        number: pr.number,
        commit_message: commitMsg
      }).then(function() {
        return self.reviewer.redis.sremAsync("pull-requests", pr.number);
      });
    }).then(function() {
      self.reviewer.redis.hsetAsync(['review-status:'+pr.number, 'merged', true]);
    });
  },

  checkAndMergePR: function(buildSucceeded, lgtms, pr) {
    var self = this;
    self.reviewer.redis.hsetAsync(['review-status:'+pr.number, 'ci-result', buildSucceeded]);
    self.reviewer.redis.hsetAsync(['review-status:'+pr.number, 'lgtm-count', lgtms.length]);
    if (lgtms.length >= self.threshold) {
      if (buildSucceeded) {
        return self.mergePR(lgtms, pr);
      } else {
        console.log("Build did not succeed, but we have enough LGTMs. Should probably poke someone, eh?");
        return self.reviewer.redis.hgetAsync(["review-pings:"+pr.number, "github"]).then(function(data) {
          if (!data) {
            /*var comment = self.buildFailedBuildNagComment();
            return self.github.issues.createCommentAsync({
              user: self.reviewer.user,
              repo: self.reviewer.repo,
              number: pr.number,
              body: comment
            }).then(function() {
              return self.reviewer.redis.hsetAsync(["review-pings:"+pr.number, "github", true]);
            });*/
          }
        });
        // TODO: Notify in slack or via github pings
      }
    } else {
      console.log("%s/%s/%s needs %d more LGTMs.", self.reviewer.user, self.reviewer.repo, pr.number, self.threshold - lgtms.length);
      // TODO: Notify in slack or via github pings
    }
  },

  buildFailedBuildNagComment: function() {
    return "I'm seeing enough +1s to merge this but the build has failed, so I won't autmoatically merge it."
  },

  buildComment: function(lgtms) {
    var people = "";
    lgtms.forEach(function(l) {
      people += format("* {login}", l.user);
    });

    return format("The build is good and I'm seeing {count} +1s from the following folks:\n\n"+
      "{people}\n\n"+
      "As such, I'll attempt to merge and close this pull request.", {
      count: lgtms.length,
      people: people
    });
  },

  buildCommitMessage: function(lgtms) {
    var people = "";
    lgtms.forEach(function(l) {
      people += format("* {login}", l.user);
    });

    return format("Automatic merge with {count} +1s.\n\n"+
      "The following people participated in the review:\n\n"+
      "{people}", {
      count: lgtms.length,
      people: people
    });
  },

  getLGTMs: function(pr, page) {
    var self = this;
    return self.github.issues.getCommentsAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number,
      per_page: 100,
      page: page
    }).then(function(comments) {
      if (comments.length > 0) {
        var lgtms = [];
        comments.forEach(function(comment) {
          if (comment.body.indexOf('LGTM') > -1 || comment.body.indexOf(':+1:') > -1) {
            lgtms.push(comment);
          }
        });
        if (comments.length == 100) {
          return self.getLGTMs(pr, page + 1).then(lgtms.concat);
        } else {
          return lgtms;
        }
      } else {
        return [];
      }
    });
  }
};

