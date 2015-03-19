var bluebird = require('bluebird');
var check = require('check-types');

module.exports = function(circleci, repolist) {
  this.circleci = circleci;
  this.repos = repolist;
}

module.exports.prototype = {
  getLatestBuilds: function(_limit) {
    check.assert.number(_limit);
    var self = this;
    var limit = _limit || 3;
    return self.repos.getRepos().then(function(repos) {
      var allBuilds = [];
      var p = [];
      repos.forEach(function(repo) {
        p.push(self.circleci.getBuilds({
          username: repo.owner.login,
          project: repo.name,
          filter: 'completed',
          limit: limit
        }).then(function(builds) {
          builds.forEach(function(build) {
            allBuilds.push({
              commit: build.all_commit_details[0],
              slug: repo.full_name,
              project_url: 'https://circleci.com/gh/'+repo.full_name,
              num: build.build_num,
              build_url: 'https://circleci.com/gh/'+repo.full_name+'/'+build.build_num,
              state: build.outcome
            });
          });
        }));
      });
      return bluebird.all(p).then(function() {
        return allBuilds;
      });
    });
  }
}
