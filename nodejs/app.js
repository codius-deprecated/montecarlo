var winston = require('./lib/winston');
var bluebird = require('bluebird');
var moment = require('moment');
var express = require('express');
var app = express();
var reviewer = require('./lib/reviewer');
var reviewers = require('./lib/reviewers');
var bodyParser = require('body-parser');
var PullRequestQueue = require('./lib/review-queue').PullRequestQueue;
var tracker = require('./lib/tracker');
var kue = require('./lib/kue');
var github = require('./lib/github');
var nconf = require('./lib/config');
var redis = require('./lib/redis');
var travis = require('./lib/travis');
var circleci = require('./lib/circleci');

var RepoList = require('./lib/repolist');
var Health = require('./lib/health');

var repos = new RepoList(github);
var health = new Health(circleci, repos);

var project = tracker.project(process.env.TRACKER_PROJECT_ID);
var queue = new PullRequestQueue(kue, github, redis);
queue.addReviewerFactory(function(r) {
  return new reviewers.LGTMProcessor(r, nconf.get('reviewers:lgtm:threshold'));
});
queue.addReviewerFactory(function(r) {
  return new reviewers.TrackerProcessor(r, project);
});
queue.addReviewerFactory(function(r) {
  return new reviewers.WebuiStateProcessor(r);
});

app.set('port', (process.env.PORT || 5000));
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.get('/api/v1/builds', function(req, res) {
  health.getLatestBuilds(1).then(function(builds) {
    res.json(builds);
  });
});

app.get('/api/v1/pull-requests', function(req, res) {
  redis.smembersAsync('pull-requests').map(Number).then(function(ids) {
    var p = [];
    ids.forEach(function(id) {
      p.push(redis.hgetallAsync('pr:'+id));
    });
    return bluebird.all(p);
  }).then(function(prs) {
    res.json(prs);
  });
});

app.get('/', function(req, res) {
  bluebird.join(
    redis.smembersAsync("pull-requests").map(Number).then(function(ids) {
      var p = [];
      ids.forEach(function(id) {
        p.push(redis.hgetallAsync('pr:'+id));
      });
      return bluebird.all(p);
    }),
    redis.hgetAsync("crawl-state", "last-run"),
    redis.hgetAsync("crawl-state", "running"),
    health.getLatestBuilds(1),
    function(reqs, lastRun, isRunning, latestBuilds) {
      var queue = {merged: [], open: [], closed: []};
      var success = 0;
      var failure = 0;
      var healthMatrix = {};
      latestBuilds.forEach(function(b) {
        if (b.state.indexOf("success") == 0) {
          success += 1;
        } else {
          failure += 1;
        }
      });
      var healthPct = success / (failure + success)
      reqs.forEach(function(r) {
        if (r) {
          if (r.state.indexOf("merged") == 0) {
            queue.merged.push(r);
          } else if (r.state.indexOf("open") == 0) {
            queue.open.push(r);
          } else if (r.state.indexOf("closed") == 0) {
            queue.closed.push(r);
          }
        }
      });
      res.render('index', {
        queue: queue,
        lastRun: moment(lastRun).format('MMM Do YY, h:mm:ss a'),
        isRunning: isRunning,
        buildStatus: latestBuilds,
        overallHealth: healthPct
      });
    }
  );
});

app.post('/github-hook', function(req, res) {
  var eventType = req.headers['x-github-event'];
  winston.log("Handling github hook: %s", eventType);
  if (eventType == 'status') {
    winston.info("Status updated on a commit in %s/%s. Reviewing all PRs.",
        req.body.repository.owner.login,
        req.body.repository.name);
    queue.enqueuePullRequest(
      req.body.repository.owner.login,
      req.body.repository.name,
      -1
    );
    res.send("Crawling.");
  } else if (eventType == 'issue_comment') {
    winston.info("New comment on %s/%s/%s. Reviewing!",
        req.body.repository.owner.login,
        req.body.repository.name,
        req.body.issue.number);
    queue.enqueuePullRequest(
      req.body.repository.owner.login,
      req.body.repository.name,
      req.body.issue.number
    );
    res.send("Crawling.");
  } else if (eventType == 'pull_request') {
    if (req.body.action == "opened" || req.body.action == "reopened" || req.body.action == "closed") {
      winston.info("Opened/reopened/closed pull request: %s/%s/%s",
          req.body.pull_request.base.repo.owner.login,
          req.body.pull_request.base.repo.name,
          req.body.pull_request.number);
      queue.enqueuePullRequest(
        req.body.pull_request.base.repo.owner.login,
        req.body.pull_request.base.repo.name,
        req.body.pull_request.number
      );
    }
    res.send("Crawling.");
  } else if (eventType == 'push') {
    winston.info("New push to %s/%s. Reviewing all PRs.",
        req.body.repository.owner.name,
        req.body.repository.name);
    queue.enqueuePullRequest(
      req.body.repository.owner.name,
      req.body.repository.name,
      -1
    );
    res.send("Crawling.");
  } else {
    res.send("Unknown event: " + JSON.stringify(req.body));
  }
});

app.get('/crawl', function(req, res) {
  repos.updateHooks().then(function() {
    return repos.getRepos();
  }).then(function(repos) {
    repos.forEach(function(repo) {
      winston.info("Crawling all pull requests in %s/%s",
          repo.owner.login,
          repo.name);
      queue.enqueuePullRequest(repo.owner.login, repo.name, -1);
    });
    res.send("Running crawler on repos!");
  });
});

module.exports = {
  app: app,
  queue: queue
};
