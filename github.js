var config = require('./config');
var reviewer = require('./lib/reviewer');

var reviewers = {
  LGTMProcessor: require('./lib/reviewers/lgtm').LGTMProcessor
};

var bluebird = require('bluebird');

var availableReviewers = [
  "tdfischer",
  "justmoon",
  "emschwartz",
  "stevenzeiler",
  "wilsonianb"
];

function randomAssignee() {
  return availableAssignees[Math.floor(Math.random()*availableAssignees.length)];
}

config.github.misc.rateLimitAsync({}).then(function(limits) {
  var min = 100;
  console.log("Only %d requests available. Limit resets in about %d minutes.", limits.resources.core.remaining, Math.ceil((limits.resources.core.reset - Math.floor(Date.now()/1000))/60));
  if (limits.resources.core.remaining > min) {
    var repos = ['codius-engine', 'codius-host', 'codius-sandbox', 'codius-sandbox-core'];
    var p = [];
    config.redis.hset("crawl-state", "running", true);
    repos.forEach(function(repoName) {
      var r = new reviewer.PullRequestReviewer(config.redis, config.github, 'codius', repoName);
      r.addProcessor(new reviewers.LGTMProcessor(config.github, r, config.lgtmThreshold));
      p.push(r.reviewAll());
    });
    return bluebird.all(p).then(function() {
      config.redis.hset("crawl-state", "running", false);
    });
  } else {
    console.log("I'll only run with at least %d requests available.", min);
  }
});
