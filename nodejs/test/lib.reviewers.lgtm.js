var bluebird = require('bluebird');

bluebird.longStackTraces();

var redis = require('redis');
var replay = require('replay');
var expect = require('chai').expect;
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised')(bluebird.Promise);
var lgtm = require('../lib/reviewers/lgtm');
var github = require('../lib/github');
var PullRequestReviewer = require('../lib/reviewer').PullRequestReviewer;

describe('LGTMReviewer', function() {
  var proc, reviewer;

  before(function() {
    sinon.stub(github.pullRequests, "mergeAsync").resolves([]);
    sinon.stub(github.issues, "createCommentAsync").resolves([]);
  });

  beforeEach(function() {
    reviewer = new PullRequestReviewer(github, 'codius', 'codius-sandbox', redis);
    proc = new lgtm.LGTMProcessor(reviewer, 1);
  });

  describe('#parseCommands', function() {
    it('extracts no commands', function() {
      expect(proc.parseCommands('NOTHING')).to.deep.equal([]);
    });

    it('extracts a bare +r', function() {
      expect(proc.parseCommands('+r')).to.deep.equal([[]]);
    });

    it('extracts a more complicated command', function() {
      expect(proc.parseCommands('+r retry')).to.deep.equal([['retry']]);
    });

    it('extracts multiple commands', function() {
      expect(proc.parseCommands('+r\nFOOBAR\n+r retry')).to.deep.equal([[], ['retry']]);
    });

    it('extracts multiple complicated commands', function() {
      expect(proc.parseCommands('+r\nFOOBAR\n+r retry\n+r retry again')).to.deep.equal([[], ['retry'], ['retry', 'again']]);
    });
  });

  describe('#getBuildStatus', function() {
    it('correctly confirms a successful build without any statuses', function() {
      return reviewer.getPullRequest(1).then(function(pr) {
        return expect(proc.getBuildStatus(pr)).to.eventually.equal(true);
      });
    });

    it('correctly confirms a successful build', function() {
      return reviewer.getPullRequest(5).then(function(pr) {
        return expect(proc.getBuildStatus(pr)).to.eventually.equal(true);
      });
    });

    it('correctly confirms a successful build after a set of fails', function() {
      return reviewer.getPullRequest(12).then(function(pr) {
        return expect(proc.getBuildStatus(pr)).to.eventually.equal(true);
      });
    });

    it('correctly confirms an unsuccessful build', function() {
      return reviewer.getPullRequest(3).then(function(pr) {
        return expect(proc.getBuildStatus(pr)).to.eventually.equal(false);
      });
    });
  });

  describe('#getCommands', function() {
    var reviewer, proc;

    beforeEach(function() {
      reviewer = new PullRequestReviewer(github, 'codius', 'codius-host', redis);
      proc = new lgtm.LGTMProcessor(reviewer, 1);
    });

    it('finds no lgtms or commands', function() {
      return reviewer.getPullRequest(1).then(function(pr) {
        return expect(proc.getCommands(pr, 1)).to.be.fulfilled.then(function(meta) {
          expect(meta.commands).to.deep.equal([]);
          expect(meta.lgtm.length).to.equal(0);
        });
      });
    });

    it('finds one lgtm and no commands', function() {
      return reviewer.getPullRequest(3).then(function(pr) {
        return expect(proc.getCommands(pr, 1)).to.be.fulfilled.then(function(meta) {
          expect(meta.commands).to.deep.equal([]);
          expect(meta.lgtm.length).to.equal(1);
        });
      });
    });

    it('finds lgtms and commands', function() {
      return reviewer.getPullRequest(43).then(function(pr) {
        return expect(proc.getCommands(pr, 1)).to.be.fulfilled.then(function(meta) {
          expect(meta.commands.length).to.equal(1);
          expect(meta.commands[0].command).to.deep.equal([]);
          expect(meta.lgtm.length).to.equal(1);
        });
      });
    });

  });

  describe('#review', function() {
    beforeEach(function() {
      reviewer = new PullRequestReviewer(github, 'codius', 'codius-host', redis);
      sinon.stub(reviewer, 'setMeta').resolves(null);
      proc = new lgtm.LGTMProcessor(reviewer, 1, null);
      sinon.spy(proc, "mergePR");
    });

    it('merges a valid pull request', function() {
      return reviewer.getPullRequest(43).then(function(pr) {
        pr.state = "open";
        pr.mergeable = true;
        return expect(proc.review(pr)).to.be.fulfilled.then(function() {
          expect(proc.mergePR.called).to.equal(true);
        });
      });
    });

    it('doesnt merge a closed pull request', function() {
      return reviewer.getPullRequest(19).then(function(pr) {
        return expect(proc.review(pr)).to.be.fulfilled.then(function() {
          expect(proc.mergePR.called).to.equal(false);
        });
      });
    });

    it('doesnt merge a previously merged pull request', function() {
      return reviewer.getPullRequest(43).then(function(pr) {
        return expect(proc.review(pr)).to.be.fulfilled.then(function() {
          expect(proc.mergePR.called).to.equal(false);
        });
      });
    });
  });
});

