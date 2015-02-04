var bluebird = require('bluebird');
var moment = require('moment');
var express = require('express');
var app = express();
var config = require('./config');
var reviewer = require('./lib/reviewer');
var reviewers = require('./lib/reviewers');
var bodyParser = require('body-parser');
var PullRequestQueue = require('./lib/review-queue').PullRequestQueue;

var project = config.pivotal.project(process.env.TRACKER_PROJECT_ID);
var queue = new PullRequestQueue(config.queue, config.github, project);
queue.addReviewerFactory(function(r) {
  return new reviewers.LGTMProcessor(r, config.lgtmThreshold);
});
queue.addReviewerFactory(function(r) {
  return new reviewers.TrackerProcessor(r, project);
});

app.set('port', (process.env.PORT || 5000));
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.get('/', function(req, res) {
  bluebird.join(
    config.redis.smembersAsync("pull-requests").map(JSON.parse),
    config.redis.hgetAsync("crawl-state", "last-run"),
    config.redis.hgetAsync("crawl-state", "running"),
    bluebird.promisify(config.travis.repos('codius').get)(),
    bluebird.promisify(config.travis.repos('ripple').get)(),
    function(reqs, lastRun, isRunning, travisRepos, rippleRepos) {
      res.render('index', {
        queue: reqs,
        lastRun: moment(lastRun).format('MMM Do YY, h:mm:ss a'),
        isRunning: isRunning,
        travis: travisRepos.repos.concat(rippleRepos.repos)
      });
    }
  );
});

config.redis.hset("crawl-state", "running", false);

app.post('/github-hook', function(req, res) {
  var eventType = req.headers['x-github-event'];
  if (eventType == 'status') {
    queue.enqueuePullRequest(
      req.body.repository.owner.login,
      req.body.repository.name,
      -1
    );
  } else if (eventType == 'issue_comment') {
    queue.enqueuePullRequest(
      req.body.repository.owner.login,
      req.body.repository.name,
      req.body.issue.number
    );
  } else if (eventType == 'pull_request') {
    if (req.body.action == "opened" || req.body.action == "reopened" || req.body.action == "closed") {
      queue.enqueuePullRequest(
        req.body.pull_request.base.repo.owner.login,
        req.body.pull_request.base.repo.name,
        req.body.pull_request.number
      );
    }
    res.send("Handling pull request");
  } else if (eventType == 'push') {
    queue.enqueuePullRequest(
      req.body.repository.owner.login,
      req.body.repository.name,
      -1
    );
  } else {
    res.send("Unknown event: " + JSON.stringify(req.body));
  }
});

app.get('/crawl', function(req, res) {
  var repos = ['codius-sandbox', 'codius-sandbox-core', 'codius-engine', 'codius-host'];
  repos.forEach(function(r) {
    queue.enqueuePullRequest('codius', r, -1);
  });
  res.send("Running crawler!");
});

app.listen(app.get('port'), function() {
  console.log('Dashboard is running at localhost:' + app.get('port'));
});

queue.processNextPullRequest().then(queue.processNextPullRequest.bind(queue));
