var circleci = require('./lib/circleci');
var Repos = require('./lib/repolist');
var github = require('./lib/github');
var Health = require('./lib/health');

var repos = new Repos(github);
var health = new Health(circleci, repos);

health.getLatestBuilds().then(function(builds) {
  var success = 0;
  var failure = 0;
  builds.forEach(function(build) {
    console.log("%s/%d: %s", build.slug, build.num, build.state);
    if (build.state.indexOf("success") === 0) {
      success += 1;
    } else {
      failure += 1;
    }
  });
  console.log("Health: %s", success / (failure+success));
});
