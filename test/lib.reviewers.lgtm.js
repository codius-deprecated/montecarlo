var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var expect = require('chai').expect;
var lgtm = require('../lib/reviewers/lgtm');
var github = require('../lib/github');
var PullRequestReviewer = require('../lib/reviewer').PullRequestReviewer;

describe('LGTMReviewer', function() {
  var proc, reviewer;

  beforeEach(function() {
    reviewer = new PullRequestReviewer(github, 'codius', 'codius-sandbox');
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
});

