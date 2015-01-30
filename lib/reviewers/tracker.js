function TrackerSearcher(user, repo, pr_id, project_id) {
  this.repo = repo;
  this.user = user;
  this.id = pr_id;
  this.project_id = project_id;
}

TrackerSearcher.prototype = {
  search: function() {
    return this.getCommits(1);
  },
  getCommits: function(page) {
    var self = this;
    return github.pullRequests.getCommitsAsync({
      repo: self.repo,
      user: self.user,
      number: self.id,
      per_page: 100,
      page: page
    }).then(function(commits) {
      if (commits.length > 0) {
        commits.forEach(function(commit) {
          var s = commit.commit.message.match(/\[(Finishes|Fixes|Delivers) #([0-9]+)\]/i);
          if (s) {
            self.updateTracker(s[2]);
          }
        });
        return self.getCommits(page + 1);
      }
    });
  },
  updateTracker: function(id) {
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
  }
};


