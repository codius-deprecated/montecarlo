var dotenv = require('dotenv');
var GitHubApi = require('github');
var tracker = require('pivotaltracker');
var bluebird = require('bluebird');
var Redis = require('redis');
var url = require('url');
var reviewer = require('./lib/reviewer');

bluebird.longStackTraces();

var reviewers = require('./reviewers');

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

var redisURL = url.parse(process.env.REDISCLOUD_URL);
var redis = Redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
redis.auth(redisURL.auth.split(":")[1]);

var pivotal = new tracker.Client(process.env.TRACKER_TOKEN);

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

bluebird.promisifyAll(github.repos);
bluebird.promisifyAll(github.misc);
bluebird.promisifyAll(github.pullRequests);
bluebird.promisifyAll(github.issues);
bluebird.promisifyAll(github.statuses);
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).labels));
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).story(0)));
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).story(0).comments));
bluebird.promisifyAll(redis);

github.authenticate({
  type: "oauth",
  token: process.env.GITHUB_TOKEN
});

/*function pullPRs(user, repo, page) {
  return github.pullRequests.getAllAsync({
    repo: repo,
    user: user,
    state: 'open',
    per_page: 100,
    page: page
  }).then(function(prs) {
    if (prs.length > 0) {
      prs.forEach(function(pr) {
        new LGTMSearcher(user, repo, pr.number).search().then(function(lgtms) {
          if (lgtms.length < lgtmThreshold) {
            console.log('Not enough +1s. Not merging %s/%s/%d.', user, repo, pr.number);
          } else {
            console.log('Got enough +1s: %s. Merging %s/%s/%d!', lgtms, user, repo, pr.number);
            var lgtmUsers = [];
            for (i = 0; i < lgtms.length; i++) {
              lgtmUsers.push(lgtms[i].login);
            }
            return github.issues.createCommentAsync({
              user: user,
              repo: repo,
              number: pr.number,
              body: "I see "+lgtms.length+" +1s from "+lgtmUsers.join(', ')+". Ready to merge."
            }).then(function(result) {
              return github.pullRequests.mergeAsync({
                user: user,
                repo: repo,
                number: pr.number,
                commit_message: "Automatically merged with "+lgtms.length+" +1s from "+lgtmUsers
              });
            }).then(function(result) {
                console.log("Successfully merged %d", 26);
            });
          }
        });
        new TrackerSearcher(user, repo, pr.number, process.env.TRACKER_PROJECT_ID).search();
      });
      pullPRs(user, repo, page + 1);
    }
  });
}*/

function getAllLGTMs() {
  return github.repos.getFromOrgAsync({
    org: 'codius',
    per_page: 100
  }).then(function(repos) {
    var p = [];
    repos.forEach(function(repo) {
      var reviewer = new reviewer.PullRequestReviewer(redis, github, repo.owner.login, repo.name);
      reviewer.addProcessor(new reviewers.LGTMProcessor(github, reviewer, 1));
      /*reviewer.addReviewer(new LGTMReviewer(github, reviewer, 2));
      reviewer.addReviewer(new TrackerReviewer(reviewer, process.env.TRACKER_PROJECT_ID));*/
      p.push(reviewer.reviewAll());
    });
    return bluebird.all(p);
  }).catch(function(e) {
    console.error(e.stack);
  });
}

github.misc.rateLimitAsync({}).then(function(limits) {
  var min = 100;
  console.log("Only %d requests available. Limit resets in about %d minutes.", limits.resources.core.remaining, Math.ceil((limits.resources.core.reset - Math.floor(Date.now()/1000))/60));
  if (limits.resources.core.remaining > min) {
    getAllLGTMs();
  } else {
    console.log("I'll only run with at least %d requests available.", min);
  }
});
