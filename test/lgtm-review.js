var bluebird = require('bluebird');
var reviewer = require('../lib/reviewer');
var chai = require('chai');
var expect = chai.expect;
var replay = require('replay');
var GitHubApi = require('github');
var dotenv = require('dotenv');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

dotenv.load();

var github = new GitHubApi({
  version: "3.0.0",
  protocol: "https",
});

bluebird.promisifyAll(github.repos);
bluebird.promisifyAll(github.misc);
bluebird.promisifyAll(github.pullRequests);
bluebird.promisifyAll(github.issues);
bluebird.promisifyAll(github.statuses);

var MockProcessor = function() {
  this.seen_ids = [];
};

MockProcessor.prototype = {
  review: function(pr) {
    this.seen_ids.push(pr.id);
  }
};

it('processes a list of pull requests', function(done) {
  var proc = new MockProcessor();
  var r = new reviewer.PullRequestReviewer(null, github, 'codius', 'codius-sandbox-core');
  r.addProcessor(proc);
  expect(r.reviewAll()).to.be.fulfilled.then(function() {
    expect(proc.seen_ids).to.deep.equal([28066085, 28066060]);
  }).then(done, function(e) {done(e);});
});
