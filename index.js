var bluebird = require('bluebird');
var moment = require('moment');
var express = require('express');
var app = express();
var config = require('./config');
var reviewer = require('./lib/reviewer');
var bodyParser = require('body-parser');

var reviewers = {
  LGTMProcessor: require('./lib/reviewers/lgtm').LGTMProcessor,
  TrackerProcessor: require('./lib/reviewers/tracker').TrackerProcessor
};

app.set('port', (process.env.PORT || 5000));
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

app.get('/', function(req, res) {
  bluebird.join(
    config.redis.smembersAsync("pull-requests").map(JSON.parse),
    config.redis.hgetAsync("crawl-state", "last-run"),
    config.redis.hgetAsync("crawl-state", "running"),
    function(reqs, lastRun, isRunning) {
      res.render('index', {
        queue: reqs,
        lastRun: moment(lastRun).format('MMM Do YY, h:mm:ss a'),
        isRunning: isRunning
      });
    }
  );
});

config.redis.hset("crawl-state", "running", false);

app.post('/github-hook', function(req, res) {
  var eventType = req.headers['x-github-event'];
  var project = config.pivotal.project(process.env.TRACKER_PROJECT_ID);
  if (eventType == 'status') {
    var r = new reviewer.PullRequestReviewer(
      config.redis,
      config.github,
      req.body.repository.owner.login,
      req.body.repository.name
    );
    r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
    r.addProcessor(new reviewers.TrackerProcessor(project, r));
    r.reviewAll();
  } else if (eventType == 'issue_comment') {
    var r = new reviewer.PullRequestReviewer(
      config.redis,
      config.github,
      req.body.repository.owner.login,
      req.body.repository.name
    );
    r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
    r.addProcessor(new reviewers.TrackerProcessor(project, r));
    r.reviewOne(req.body.issue.number);
  } else if (eventType == 'pull_request') {
    if (req.body.action == "opened" || req.body.action == "reopened" || req.body.action == "closed") {
      var r = new reviewer.PullRequestReviewer(
        config.redis,
        config.github,
        req.body.pull_request.base.repo.owner.login,
        req.body.pull_request.base.repo.name
      );
      r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
      r.addProcessor(new reviewers.TrackerProcessor(project, r));
      r.reviewOne(req.body.pull_request.number);
    }
    res.send("Handling pull request");
  } else if (eventType == 'push') {
    var r = new reviewer.PullRequestReviewer(
      config.redis,
      config.github,
      req.body.repository.owner.login,
      req.body.repository.name
    );
    r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
    r.addProcessor(new reviewers.TrackerProcessor(project, r));
    r.reviewAll();
    res.send("Starting to handle push");
  } else {
    res.send("Unknown event: " + JSON.stringify(req.body));
  }
});

app.get('/crawl', function(req, res) {
  var repos = ['codius-engine', 'codius-host', 'codius-sandbox', 'codius-sandbox-core'];
  var p = [];
  var project = config.pivotal.project(process.env.TRACKER_PROJECT_ID);
  config.redis.hgetAsync("crawl-state", "running").then(function(isRunning) {
    if (!JSON.parse(isRunning)) {
      config.redis.hset("crawl-state", "running", true);
      repos.forEach(function(repoName) {
        var r = new reviewer.PullRequestReviewer(config.redis, config.github, 'codius', repoName);
        r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
        r.addProcessor(new reviewers.TrackerProcessor(project, r));
        p.push(r.reviewAll());
      });
      res.send("Running crawler!");
      return bluebird.all(p).finally(function() {
        config.redis.hset("crawl-state", "running", false);
      });
    } else {
      res.send("Crawler is already running.");
    }
  });
});

app.listen(app.get('port'), function() {
  console.log('Dashboard is running at localhost:' + app.get('port'));
});
