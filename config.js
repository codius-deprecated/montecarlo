var tracker = require('pivotaltracker');
var Redis = require('redis');
var url = require('url');
var GitHubApi = require('github');
var dotenv = require('dotenv');
var bluebird = require('bluebird');
var Travis = require('travis-ci');
var kue = require('kue');

bluebird.longStackTraces();

dotenv.load();

bluebird.promisifyAll(require('pivotaltracker/lib/resources/label').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/label').Label.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/story').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/story').Story.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/comment').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/comment').Comment.prototype);
bluebird.promisifyAll(Redis.RedisClient.prototype);

var travis = new Travis({
  version: '2.0.0'
});

var redis = {};
var queueOptions = {};
if (process.env.REDISCLOUD_URL) {
  var redisURL = url.parse(process.env.REDISCLOUD_URL);
  redis = Redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
  queueOptions = {
    port: redisURL.port,
    host: redisURL.hostname
  };

  if (redisURL.auth) {
    redis.auth(redisURL.auth.split(":")[1]);
    queueOptions.auth = redisURL.auth.split(":")[1];
  }
} else {
  redis = Redis.createClient();
  queueOptions = {};
}

var queue = kue.createQueue({
  redis: queueOptions
});

var pivotal = new tracker.Client(process.env.TRACKER_TOKEN);

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

if (process.env.GITHUB_TOKEN) {
  github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_TOKEN
  });
}

bluebird.promisifyAll(github.repos);
bluebird.promisifyAll(github.misc);
bluebird.promisifyAll(github.pullRequests);
bluebird.promisifyAll(github.issues);
bluebird.promisifyAll(github.statuses);

module.exports = {
  github: github,
  pivotal: pivotal,
  redis: redis,
  lgtmThreshold: 1,
  travis: travis,
  queue: queue
}
