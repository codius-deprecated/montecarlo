var dotenv = require('dotenv');
var GitHubApi = require('github');

dotenv.load();

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

github.authenticate({
  type: "oauth",
  token: process.env.GITHUB_TOKEN
});

function LGTMSearcher(user, repo, pr_id, callback) {
  this.repo = repo;
  this.user = user;
  this.id = pr_id;
  this.lgtms = [];
  this.finished = callback;
}

LGTMSearcher.prototype = {
  search: function() {
    this.pullComments(0);
  },

  pullComments: function(page) {
    var self = this;
    github.pullRequests.getComments(
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
          self.finished(self.lgtms);
        } else {
          comments.forEach(function(comment) {
            if (comment.body.indexOf('LGTM') > -1 || comment.body.indexOf(':+1:') > -1) {
              console.log("+1 from %s for %s/%s/%s", comment.user.login, self.user, self.repo, self.id);
              self.lgtms.append({user: comment.user, body: comment.body});
            }
          });
          self.pullComments(page + 1);
        }
      }
    );
  }
};

function pullPRs(user, repo, page, callback) {
  github.pullRequests.getAll(
    {
      repo: repo,
      user: user,
      state: 'open',
      per_page: 100,
      page: page
    },
    function(err, result) {
      if (err) {
        console.error("Github error: %s", err);
      } else {
        result.forEach(function(pr) {
          console.log("Pull request %s/%s/%d is still open.", user, repo, pr.number);
          new LGTMSearcher(user, repo, pr.number, function(lgtms) {
            console.log('got lgtms: %s', lgtms);
          }).search();
        });
        pullPRs(user, repo, page + 1, callback);
      }
    }
  );
}

function findLGTMs(user, repo) {
  pullPRs(user, repo, 0, function(lgtms) {
    console.log("Got LGTMs: %s", lgtms);  
  });
}

function getAllLGTMs() {
  github.repos.getFromOrg({
    org: 'codius'
  }, function(err, repos) {
    if (err) {
      console.log(err);
    } else {
      repos.forEach(function(repo) {
        console.log("Searching for LGTMs on %s", repo.name);
        findLGTMs(repo.owner.login, repo.name);  
      });
    }
  });
}

github.misc.rateLimit({}, function(err, limits) {
  if (limits.resources.core.remaining > 100) {
    getAllLGTMs();
  } else {
    console.log("Not enough requests available. Limit resets in about %d minutes.", Math.ceil((limits.resources.core.reset - Math.floor(Date.now()/1000))/60));
  }
});
