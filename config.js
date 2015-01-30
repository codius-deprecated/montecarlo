var tracker = require('pivotaltracker');
var Redis = require('redis');
var url = require('url');
var GitHubApi = require('github');
var dotenv = require('dotenv');
var bluebird = require('bluebird');
bluebird.longStackTraces();

dotenv.load();

var redisURL = url.parse(process.env.REDISCLOUD_URL);
var redis = Redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});

if (redisURL.auth) {
  redis.auth(redisURL.auth.split(":")[1]);
}

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
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).labels));
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).story(0)));
bluebird.promisifyAll(Object.getPrototypeOf(pivotal.project(0).story(0).comments));
bluebird.promisifyAll(redis);

module.exports = {
  github: github,
  pivotal: pivotal,
  redis: redis
}
