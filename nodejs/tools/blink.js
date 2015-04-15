var circleci = require('../lib/circleci');
var Blink1 = require('node-blink1');
var bluebird = require('bluebird');

var blink = new Blink1();

var validProjects = ['codius-host', 'codius-cli', 'codius-engine', 'codius.org'];

function doColor(r, g, b, _time) {
  var time = _time || 5000;
  return new bluebird.Promise(function(resolve, reject) {
    blink.fadeToRGB(time, r, g, b, resolve);
  });
}

var lastGoodBuilds = 0;
var lastBadBuilds = 0;

function pollBuilds() {
  console.log("Polling circleci");
  circleci.getProjects().then(function(projects) {
    var goodBuilds = 0;
    var badBuilds = 0;
    projects.forEach(function(r) {
      if (validProjects.indexOf(r.reponame) != -1) {
        Object.keys(r.branches).forEach(function(k) {
          var b = r.branches[k].recent_builds[0];
          if (b.outcome.indexOf('success') == 0) {
            goodBuilds += 1;
          } else {
            badBuilds += 1;
          }
        });
      }
    });
    var totalBuilds = goodBuilds + badBuilds;
    var red = 255 * (badBuilds / totalBuilds);
    var green = 255 * (goodBuilds / totalBuilds);
    console.log("Build health: %d/%d", goodBuilds, totalBuilds);
    setTimeout(pollBuilds, 10000);
    var p;
    if (goodBuilds > lastGoodBuilds) {
      p = doColor(0, 255, 0, 250);
    } else if (badBuilds > lastBadBuilds) {
      p = doColor(255, 0, 0, 250);
    } else if (badBuilds == 0 && lastBadBuilds > 0) {
      p = doColor(255, 255, 255, 250).then(function() {
        return doColor(255, 0, 0, 250);
      }).then(function() {
        return doColor(0, 255, 0, 250);
      }).then(function() {
        return doColor(0, 0, 255, 250);
      });
    }
    lastGoodBuilds = goodBuilds;
    lastBadBuilds = badBuilds;
    return p.then(function() {doColor(red, green, 0);});
  });
}

doColor(255, 255, 255, 250).then(function() {
  return doColor(0, 0, 255, 250)
}).then(pollBuilds);
