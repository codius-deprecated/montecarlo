var dotenv = require('dotenv');
var GitHubApi = require('github');
var tracker = require('pivotaltracker');

dotenv.load();

var availableReviewers = [
  "tdfischer",
  "justmoon",
  "emschwartz",
  "stevenzeiler",
  "wilsonianb"
];

var lgtmThreshold = 1;

function randomAssignee() {
  return availableAssignees[Math.floor(Math.random()*availableAssignees.length)];
}

var pivotal = new tracker.Client(process.env.TRACKER_TOKEN);

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

github.authenticate({
  type: "oauth",
  token: process.env.GITHUB_TOKEN
});

function TrackerSearcher(user, repo, pr_id, project_id) {
  this.repo = repo;
  this.user = user;
  this.id = pr_id;
  this.project_id = project_id;
}

TrackerSearcher.prototype = {
  search: function() {
    var self = this;
    console.log('Searching for tracker commits on %s/%s/%d', self.user, self.repo, self.id);
    self.getCommits(0);
  },
  getCommits: function(page) {
    var self = this;
    github.pullRequests.getCommits(
      {
        repo: self.repo,
        user: self.user,
        number: self.id,
        per_page: 100,
        page: page
      },
      function(err, commits) {
        if (err) {
          console.error(err);
        } else {
          if (commits.length > 0) {
            commits.forEach(function(commit) {
              var s = commit.commit.message.match(/\[(Finishes|Fixes|Delivers) #([0-9]+)\]/i);
              if (s) {
                self.updateTracker(s[2]);
              }
            });
            self.getCommits(page + 1);
          }
        }
      }
    );
  },
  updateTracker: function(id) {
    var self = this;
    self.project_id = 1262710;
    id = 87138074;
    var storyObj = pivotal.project(self.project_id).story(id);
    pivotal.project(self.project_id).labels.all(function(err, result) {
      var reviewLabel;
      for (idx in result) {
        if (result[idx].name == 'needs-review') {
          reviewLabel = result[idx];
        }
      }
      if (!reviewLabel) {
        reviewLabel = pivotal.project(self.project_id).labels.create({name: 'needs-review'});
      }
      storyObj.get(function(err, story) {
        if (err) {
          console.error(err);
        } else {
          if (story.currentState == 'finished') {
            var labels = story.labels;
            labels.push(reviewLabel);
            console.log("Moving %d to needs-review", id);
            storyObj.update({currentState: 'delivered', labels: labels}, function(err, result) {
              if (err) {
                console.error(err);
              } else {
                console.log('updated: %s', result);
                storyObj.comments.create(
                  {
                    project_id: self.project_id,
                    story_id: id,
                    text: "Github pull request: https://github.com/"+self.user+"/"+self.repo+"/pull/"+self.id
                  },
                  function(err, result) {
                    if (err) {
                      console.error(err);
                    } else {
                      console.log("Added comment");
                    }
                  }
                );
              }
            });
          }
        }
      });
    });
  }
};

function LGTMSearcher(user, repo, pr_id, callback) {
  this.repo = repo;
  this.user = user;
  this.id = pr_id;
  this.lgtms = [];
  this.finished = callback;
}

LGTMSearcher.prototype = {
  search: function() {
    this.pullComments(1);
  },

  pullComments: function(page) {
    var self = this;
    github.issues.getComments(
      {
        repo: self.repo,
        user: self.user,
        number: self.id,
        per_page: 100,
        page: page
      },
      function(err, comments) {
        if (err) {
          console.error('Github error: %s', err);
        } else {
          if (comments.length > 0) {
            comments.forEach(function(comment) {
              if (comment.body.indexOf('LGTM') > -1 || comment.body.indexOf(':+1:') > -1) {
                console.log("+1 from %s for %s/%s/%s", comment.user.login, self.user, self.repo, self.id);
                self.lgtms.push({user: comment.user, body: comment.body});
              }
            });
            self.pullComments(page + 1);
          /*} else if (page == 1) {
            var assigneeList = [];
            for(i = 0; i < lgtmThreshold; i++) {
              var assignee;
              do {
                assignee = randomAssignee();
              } while (!(assignee in assigneeList));
              assigneeList.push("@"+assignee);
            }

            var assignees = assigneeList.join(', ');

            github.issues.createComment(
              {
                user: self.user,
                repo: self.repo,
                number: self.id,
                body: "No assignees detected. I'm randomly assigning "+assignees+" to review this."
              }
            );*/
          } else {
            self.finished(self.lgtms);
          }
        }
      }
    );
  }
};

function pullPRs(user, repo, page) {
  github.pullRequests.getAll(
    {
      repo: repo,
      user: user,
      state: 'open',
      per_page: 100,
      page: page
    },
    function(err, prs) {
      if (err) {
        console.error("Github error: %s", err);
      } else {
        if (prs.length > 0) {
          prs.forEach(function(pr) {
            new LGTMSearcher(user, repo, pr.number, function(lgtms) {
              if (lgtms.length < lgtmThreshold) {
                console.log('Not enough +1s. Not merging %s/%s/%d.', user, repo, pr.number);
              } else {
                console.log('Got enough +1s: %s. Merging %s/%s/%d!', lgtms, user, repo, pr.number);
                var lgtmUsers = [];
                for (i = 0; i < lgtms.length; i++) {
                  lgtmUsers.push(lgtms[i].login);
                }
                github.issues.createComment(
                  {
                    user: user,
                    repo: repo,
                    number: pr.number,
                    body: "I see "+lgtms.length+" +1s from "+lgtmUsers.join(', ')+". Ready to merge."
                  },
                  function(err, result) {
                    if (err) {
                      console.error(err);
                    } else {
                      github.pullRequests.merge(
                        {
                          user: user,
                          repo: repo,
                          number: pr.number,
                          commit_message: "Automatically merged with "+lgtms.length+" +1s from "+lgtmUsers
                        },
                        function(err, result) {
                          if (err) {
                            console.log(err);
                          } else {
                            console.log("Successfully merged %d", 26);
                          }
                        }
                      );
                    }
                  }
                );
              }
            }).search();
            /*new TrackerSearcher(user, repo, pr.number, process.env.TRACKER_PROJECT_ID).search();*/
          });
          pullPRs(user, repo, page + 1);
        }
      }
    }
  );
}

function findLGTMs(user, repo) {
  pullPRs(user, repo, 1);
}

function getAllLGTMs() {
  github.repos.getFromOrg({
    org: 'codius',
    per_page: 100
  }, function(err, repos) {
    if (err) {
      console.log(err);
    } else {
      repos.forEach(function(repo) {
        findLGTMs(repo.owner.login, repo.name);  
      });
    }
  });
}

github.misc.rateLimit({}, function(err, limits) {
  var min = 100;
  console.log("Only %d requests available. Limit resets in about %d minutes.", limits.resources.core.remaining, Math.ceil((limits.resources.core.reset - Math.floor(Date.now()/1000))/60));
  if (limits.resources.core.remaining > min) {
    getAllLGTMs();
  } else {
    console.log("I'll only run with at least %d requests available.", min);
  }
});
