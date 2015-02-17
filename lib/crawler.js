var bluebird = require('bluebird');

module.exports.Crawler = function(github) {
  this.github = github;
}

module.exports.Crawler.prototype = {
  crawl: function() {
    var self = this;
    return self.getRepos(1);
  },
  getRepos: function(page) {
    var self = this;
    var allRepos = [];
    return self.github.user.getTeamsAsync().then(function(teams) {
      var p = [];
      teams.forEach(function(t) {
        p.push(self.github.orgs.getTeamReposAsync({
          id: t.organization.id,
          page: page
        }).then(function(repos) {
          return allRepos.concat(repos);
        }));
      });
      return bluebird.all(p).then(function() {
        return allRepos;
      });
    });
  }
}
