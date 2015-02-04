var moment = require('moment');
var bluebird = require('bluebird');

module.exports.WebuiStateProcessor = function(reviewer, redis) {
  this.reviewer = reviewer;
  this.redis = redis;
}

module.exports.WebuiStateProcessor.prototype = {
  review: function(pr) {
    var self = this;
    var prBlip = {
      user: self.reviewer.user,
      repo: self.reviewer.repo,
      number: pr.number,
      state: pr.state,
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
      console.log("Storing state of %d", pr.id);
      return bluebird.all([
        self.redis.hmsetAsync('pr:'+pr.id, prBlip),
        self.redis.saddAsync("pull-requests", pr.id)
      ]);
    });
  },
};
