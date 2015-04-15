var bluebird = require('bluebird');
var redis = require('./redis');
var Warlock = require('node-redis-warlock');

var warlock = Warlock(redis);

bluebird.promisifyAll(warlock);

module.exports = warlock;
