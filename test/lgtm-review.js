var config = require('../config');
var reviewer = require('../lib/reviewer');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var expect = chai.expect;
var replay = require('replay');
var sinon = require('sinon');

chai.use(chaiAsPromised);

sinon.stub(config.redis, "hset", function(){});

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
  var r = new reviewer.PullRequestReviewer(config.redis, config.github, 'codius', 'codius-sandbox-core');
  r.addProcessor(proc);
  expect(r.reviewAll()).to.be.fulfilled.then(function() {
    expect(proc.seen_ids).to.deep.equal([28066085, 28066060]);
  }).then(done, function(e) {done(e);});
});
