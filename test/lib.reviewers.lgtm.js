var bluebird = require('bluebird');

bluebird.longStackTraces();

var replay = require('replay');
var expect = require('chai').expect;
var lgtm = require('../lib/reviewers/lgtm');

describe('LGTMReviewer', function() {
  var proc;

  beforeEach(function() {
    proc = new lgtm.LGTMProcessor(null, 1);
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
});

