var bluebird = require('bluebird');
var tracker = require('pivotaltracker');
var nconf = require('./config');

bluebird.promisifyAll(require('pivotaltracker/lib/resources/label').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/label').Label.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/story').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/story').Story.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/comment').Service.prototype);
bluebird.promisifyAll(require('pivotaltracker/lib/resources/comment').Comment.prototype);

module.exports = new tracker.Client(nconf.get('TRACKER_TOKEN'));
