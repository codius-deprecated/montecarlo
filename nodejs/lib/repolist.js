var winston = require('./winston');
var bluebird = require('bluebird');
var check = require('check-types');

module.exports = function(github) {
  check.assert.object(github);
  this.github = github;
}

module.exports.prototype = {
  getRepos: function() {
    var self = this;
    return self.github.user.getTeamsAsync({}).then(function(teams) {
      var p = [];
      teams.forEach(function(team) {
        winston.info("Looking for all repos in team %s/%s",
            team.organization.login,
            team.name);
        p.push(self.github.orgs.getTeamReposAsync({
          id: team.id,
          per_page: 100
        }));
      });
      return bluebird.all(p);
    }).then(function(repoSets) {
      var p = [];
      repoSets.forEach(function(set) {
        set.forEach(function(repo) {
          p.push(repo);
        });
      });
      return p;
    });
  },
  updateHooks: function() {
    var self = this;
    return self.getRepos().each(function(repo) {
      return self.github.repos.getHooksAsync({
        user: repo.owner.login,
        repo: repo.name,
      }).then(function(hooks) {
        var active = false;
        hooks.forEach(function(hook) {
          if (hook.config.url) {
            if (hook.config.url.indexOf("http://build.codius.org/github-hook") === 0) {
              active = true;
            }
          }
        });
        if (!active) {
          winston.info("Enabling hook on %s/%s", repo.owner.login, repo.name);
          return self.github.repos.createHookAsync({
            user: repo.owner.login,
            repo: repo.name,
            name: 'web',
            config: {
              url: 'http://build.codius.org/github-hook',
              content_type: 'json'
            },
            events: '*',
            active: true
          });
        }
      });
    });
  }
}
