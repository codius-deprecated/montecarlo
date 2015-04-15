var nconf = require('./config');
var GitHubApi = require('github');
var bluebird = require('bluebird');

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

if (nconf.get('GITHUB_TOKEN')) {
  github.authenticate({
    type: "oauth",
    token: nconf.get('GITHUB_TOKEN')
  });
}

bluebird.promisifyAll(github.repos);
bluebird.promisifyAll(github.misc);
bluebird.promisifyAll(github.pullRequests);
bluebird.promisifyAll(github.issues);
bluebird.promisifyAll(github.statuses);
bluebird.promisifyAll(github.user);
bluebird.promisifyAll(github.orgs);

module.exports = github;
