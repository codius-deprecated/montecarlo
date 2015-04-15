var format = require('string-template');
var bluebird = require('bluebird');

function TrackerProcessor(reviewer, project) {
  this.reviewer = reviewer;
  this.project = project;
}

TrackerProcessor.prototype = {
  review: function(pr) {
    var self = this;
    return bluebird.join(
      self.getTrackerStories(pr, 1),
      pr,
      self.updateTracker.bind(self));
    return this.getCommits(pr, 1);
  },
  getTrackerStories: function(pr, page) {
    var self = this;
    return self.reviewer.github.pullRequests.getCommitsAsync({
      repo: self.reviewer.repo,
      user: self.reviewer.user,
      number: pr.number,
      per_page: 100,
      page: page
    }).then(function(commits) {
      var stories = [];
      if (commits.length > 0) {
        commits.forEach(function(commit) {
          commit.commit.message.split(/\r?\n/).forEach(function(line) {
            var s = line.match(/\[(Finishes|Fixes|Delivers):? #([0-9]+)\]/i);
            if (s) {
              stories.push(Number(s[2]));
            }
          });
        });
        if (commits.length == 100) {
          return self.getCommits(page + 1, pr).then(function(s) {
            return stories.concat(s);
          });
        }
      }
      return stories;
    });
  },
  updateTracker: function(stories, pr) {
    var self = this;
    var p = [];
    stories.forEach(function(s) {
      if (pr.state == "open") {
        p.push(self.getReviewLabel().then(function(label) {
          return self.markStoryInReview(label, s, pr);
        }));
      } else if (pr.state == "closed" && pr.merged == true) {
        p.push(self.reviewer.github.pullRequests.getMergedAsync({
          repo: self.reviewer.repo,
          user: self.reviewer.user,
          number: pr.number
        }).then(function(s) {
          return self.markStoryDelivered(s, pr)
        }));
      }
    });
    return bluebird.all(p);
  },
  getReviewLabel: function() {
    var self = this;
    return self.project.labels.allAsync().then(function(result) {
      for (idx in result) {
        if (result[idx].name == 'needs-review') {
          return result[idx];
        }
      }

      return self.project.labels.createAsync({name: 'needs-review'});
    });
  },
  markStoryInReview: function(label, id, pr) {
    var self = this;
    var storyObj = self.project.story(id);
    return storyObj.getAsync().then(function(story) {
      if (story.currentState == 'unstarted') {
        story.labels.push(label);
        return bluebird.all([
          storyObj.updateAsync({
            currentState: 'started',
            labels: story.labels
          }),
          storyObj.comments.createAsync({
            project_id: self.project.id,
            story_id: id,
            text: self.buildTrackerComment(pr.number)
          })
        ]);
      }
    });
  },
  markStoryDelivered: function(id, pr) {
    var self = this;
    var storyObj = self.project.story(id);
    return storyObj.getAsync().then(function(story) {
      if (story.currentState == 'finished' || story.currentState == 'started') {
        return storyObj.updateAsync({
          currentState: 'delivered',
        });
      }
    });
  },
  markStoryAccepted: function(id, pr) {
    var self = this;
    var storyObj = self.project.story(id);
    return storyObj.getAsync().then(function(story) {
      if (story.currentState == 'delivered') {
        return storyObj.updateAsync({
          currentState: 'accepted',
        });
      }
    });
  },
  buildTrackerComment: function(number) {
    var self = this;
    return format("Github pull request: https://github.com/{user}/{repo}/pull/{number}",
      {
        user: self.reviewer.user,
        repo: self.reviewer.repo,
        number: number
      }
    );
  }
  /*updateTracker: function(id) {
    var self = this;
    self.project_id = 1262710;
    id = 87138074;
    var storyObj = pivotal.project(self.project_id).story(id);
    pivotal.project(self.project_id).labels.allAsync().then(function(result) {
      for (idx in result) {
        if (result[idx].name == 'needs-review') {
          return result[idx];
        }
      }

      return pivotal.project(self.project_id).labels.createAsync({name: 'needs-review'});
    }).then(function(reviewLabel) {
      return storyObj.getAsync().then(function(story) {
        if (story.currentState == 'finished') {
          story.labels.push(reviewLabel);
          return bluebird.join(storyObj.updateAsync({
            currentState: 'delivered',
            labels: story.labels
          }), storyObj.comments.createAsync({
            project_id: self.project_id,
            story_id: id,
            text: "Github pull request: https://github.com/"+self.user+"/"+self.repo+"/pull/"+self.id
          }).then(function(result) {
            console.log("Added comment and moved to needs-review");
          }));
        }
      });
    });
  }*/
};

module.exports.TrackerProcessor = TrackerProcessor;
