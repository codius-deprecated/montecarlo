var moment = require('moment');
var bluebird = require('bluebird');

module.exports.WebuiStateProcessor = function(reviewer) {
  this.reviewer = reviewer;
}

module.exports.WebuiStateProcessor.prototype = {
  review: function(pr) {
    var self = this;
    var prBlip = {
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      number: pr.number,
      state: pr.state,
      title: pr.title,
      lastSeen: moment()
    };
    return self.reviewer.github.pullRequests.getMergedAsync({
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      number: pr.number
    }).then(function() {
      prBlip.state = "merged";
    }).catch(function() {
    }).finally(function() {
      return self.reviewer.setMeta(pr, prBlip);
    });
  },
};
