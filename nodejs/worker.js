var config = require('./config');
var PullRequestQueue = require('./lib/review-queue').PullRequestQueue;

var project = config.pivotal.project(process.env.TRACKER_PROJECT_ID);
var queue = new PullRequestQueue(config.queue, config.github, project);

queue.processNextPullRequest().then(queue.processNextPullRequest.bind(queue));
