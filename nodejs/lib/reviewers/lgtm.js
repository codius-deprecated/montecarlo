var winston = require('../winston');
var format = require('string-template');
var bluebird = require('bluebird');
var shuffle = require('shuffle-array');

module.exports.LGTMProcessor = function(reviewer, lgtmThreshold) {
  this.reviewer = reviewer;
  this.threshold = lgtmThreshold;
}

module.exports.LGTMProcessor.prototype = {
  review: function(pr) {
    var self = this;
    return bluebird.join(
      self.getBuildStatus(pr, 1),
      bluebird.join(
        self.getCommands(pr, 1),
        self.getReporterCommands(pr),
        function(commands, reporterCommands) {
          return {
            lgtm: commands.lgtm.concat(reporterCommands.lgtm),
            commands: commands.commands.concat(reporterCommands.commands)
          }
        }
      ),
      pr,
      self.checkAndMergePR.bind(self));
  },

  getBuildStatus: function(pr, page) {
    var self = this;
    return self.reviewer.github.statuses.getCombinedAsync({
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      sha: pr.head.sha
    }).then(function(combined) {
      var st = true;
      combined.statuses.forEach(function(s) {
        if (s.context.indexOf("continuous-integration/travis-ci") == 0 && s.state != "success") {
          st = false;
        } else if (s.context.indexOf("ci/circleci") == 0 && s.state != "success") {
          st = false;
        }
      });
      return st;
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
    var reviewRequested = false;
    var reviewers = [];
    if (pr.state.indexOf("open") == -1) {
      winston.debug("%s/%s/%s is not open, it is %s",
          self.reviewer.user,
          self.reviewer.repo,
          pr.number,
          pr.state);
      return self.reviewer.setMeta(pr, 'reviewState', 'finished');
    }
    metadata.commands.forEach(function(c) {
      if (c.command.length == 0) {
        reviewRequested = true;
      } else {
        if (c.command[0].indexOf("assign") == 0) {
          c.command.slice(2).forEach(function(r) {
            reviewers.push(r);
          });
        }
      }
    });
    if (reviewRequested) {
      if (metadata.lgtm.length >= self.threshold) {
        if (buildSucceeded) {
          if (pr.mergeable === false) {
            winston.info("%s/%s/%s is not mergeable yet.",
                self.reviewer.user,
                self.reviewer.repo,
                pr.number);
            return self.reviewer.setMeta(pr, 'reviewState', 'rebase-needed');
          } else {
            return self.mergePR(metadata, pr).then(function() {
              return self.reviewer.setMeta(pr, 'reviewState', 'finished');
            });
          }
        } else {
          winston.info("Build for %s/%s/%s did not succeed, but we have enough LGTMs. Should probably poke someone, eh?",
              self.reviewer.user,
              self.reviewer.repo,
              pr.number);
          return self.reviewer.setMeta(pr, 'reviewState', 'build-failure');
          // TODO: Notify in slack or via github pings
        }
      } else if (reviewers.length == 0 && false) {
        var availableReviewers = ["tdfischer", "wilsonianb", "stevenzeiler"];
        var people = shuffle.pick(availableReviewers, { picks: self.threshold });
        if (self.threshold == 1)
          people = [people];
        var comment = format("Review has been requested, but I see no "+
          "reviewers assigned. Here's who wins:\n\n"+
          "+r assign {people}\n\n"+
          "Come on down and claim your prize!",
          {
            people: people.join(' ')
          }
        );
        return self.reviewer.github.issues.createCommentAsync({
          user: self.reviewer.user,
          repo: self.reviewer.repo,
          number: pr.number,
          body: comment
        }).then(function() {
          var blip = {
            reviewers: people.join(' '),
            reviewState: 'needs-lgtms'
          };
          winston.info("Assigned reviewers to %s/%s/%s", self.reviewer.user, self.reviewer.repo, pr.number, self.threshold - metadata.lgtm.length);
          return self.reviewer.setMeta(pr, blip);
        });
      } else {
        winston.info("%s/%s/%s needs %d more LGTMs.", self.reviewer.user, self.reviewer.repo, pr.number, self.threshold - metadata.lgtm.length);
        return self.reviewer.setMeta(pr, 'reviewState', 'needs-lgtms');
      }
    } else {
      winston.debug('No review requested yet.');
      return self.reviewer.setMeta(pr, 'reviewState', 'pre-review');
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

  parseCommands: function(text) {
    var c = [];
    text.split(/\r?\n/).forEach(function(line) {
      var m = line.match(/\+r( (.+))?/);
      if (m) {
        if (m[2]) {
          c.push(m[2].split(/ /));
        } else {
          c.push([]);
        }
      }
    });
    return c;
  },

  getReporterCommands: function(pr) {
    var self = this;
    return self.reviewer.github.issues.getRepoIssueAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number
    }).then(function(issue) {
      var metadata = {
        lgtm: [],
        commands: []
      };
      self.parseCommands(issue.body).forEach(function(c) {
        metadata.commands.push({'source': issue, 'command': c});
      });
      return metadata;
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
          self.parseCommands(comment.body).forEach(function(c) {
            metadata.commands.push({'source': comment, 'command': c});
          });
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

