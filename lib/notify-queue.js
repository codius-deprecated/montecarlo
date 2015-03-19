var bluebird = require('bluebird');

module.exports = function(queue) {
  this.queue = queue;
}

module.exports.prototype = {
  notifyTeam: function(message) {
    var self = this;
    return new bluebird.Promise(function(resolve, reject) {
      self.queue.create('team-notifications', {
        message: message
      }).save(function(err) {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
}
