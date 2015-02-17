var format = require('string-template');
var bluebird = require('bluebird');

module.exports.LGTMProcessor = function(reviewer, lgtmThreshold) {
  this.reviewer = reviewer;
  this.threshold = lgtmThreshold;
}

module.exports.LGTMProcessor.prototype = {
  review: function(pr) {
    var self = this;
    return bluebird.join(
      self.getBuildStatus(pr, 1),
      self.getCommands(pr, 1),
      pr,
      self.checkAndMergePR.bind(self));
  },

  getBuildStatus: function(pr, page) {
    var self = this;
    return self.reviewer.github.pullRequests.getCommitsAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number,
      per_page: 1,
      page: page
    }).then(function(commits) {
      var p = [];
      if (commits.length > 0) {
        commits.forEach(function(commit) {
          p.push(self.reviewer.github.statuses.getCombinedAsync({
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

  mergePR: function(metadata, pr) {
    var self = this;
    var comment = self.buildComment(metadata);
    var commitMsg = self.buildCommitMessage(metadata);
    return self.reviewer.github.issues.createCommentAsync({
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      number: pr.number,
      body: comment
    }).then(function() {
      return self.reviewer.github.pullRequests.mergeAsync({
        user: self.reviewer.user,
        repo: self.reviewer.repo,
        number: pr.number,
        commit_message: commitMsg
      });
    });
  },

  checkAndMergePR: function(buildSucceeded, metadata, pr) {
    var self = this;
    if (metadata.lgtm.length >= self.threshold) {
      if (buildSucceeded && pr.state == "open") {
        return self.mergePR(metadata, pr);
      } else {
        console.log("Build did not succeed, but we have enough LGTMs. Should probably poke someone, eh?");
        if (!data) {
          /*var comment = self.buildFailedBuildNagComment();
          return self.reviewer.github.issues.createCommentAsync({
            user: self.reviewer.user,
            repo: self.reviewer.repo,
            number: pr.number,
            body: comment
          }).then(function() {
            return self.reviewer.redis.hsetAsync(["review-pings:"+pr.number, "github", true]);
          });*/
        }
        // TODO: Notify in slack or via github pings
      }
    } else {
      console.log("%s/%s/%s needs %d more LGTMs.", self.reviewer.user, self.reviewer.repo, pr.number, self.threshold - metadata.lgtm.length);
      // TODO: Notify in slack or via github pings
    }
  },

  buildFailedBuildNagComment: function() {
    return "I'm seeing enough +1s to merge this but the build has failed, so I won't autmoatically merge it."
  },

  buildComment: function(metadata) {
    var people = "";
    metadata.lgtm.forEach(function(l) {
      people += format("* {login}", l.user);
    });

    return format("The build is good and I'm seeing {count} +1s from the following folks:\n\n"+
      "{people}\n\n"+
      "As such, I'll attempt to merge and close this pull request.", {
      count: metadata.lgtm.length,
      people: people
    });
  },

  buildCommitMessage: function(metadata) {
    var people = "";
    metadata.lgtm.forEach(function(l) {
      people += format("* {login}", l.user);
    });

    return format("Automatic merge with {count} +1s.\n\n"+
      "The following people participated in the review:\n\n"+
      "{people}", {
      count: metadata.lgtm.length,
      people: people
    });
  },

  getCommands: function(pr, page) {
    var self = this;
    return self.reviewer.github.issues.getCommentsAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number,
      per_page: 100,
      page: page
    }).then(function(comments) {
      var metadata = {
        lgtm: [],
        commands: []
      };
      if (comments.length > 0) {
        comments.forEach(function(comment) {
          if (comment.body.indexOf('LGTM') > -1 || comment.body.indexOf(':+1:') > -1) {
            metadata.lgtm.push(comment);
          }
        });
        if (comments.length == 100) {
          return self.getCommands(pr, page + 1).then(function(v) {
            return {
              lgtm: metadata.lgtm.concat(v.lgtm),
              commands: metadata.commands.concat(v.commands)
            }
          });
        } else {
          return metadata;
        }
      } else {
        return metadata;
      }
    });
  }
};

