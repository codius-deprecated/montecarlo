var Redis = require('redis');
var bluebird = require('bluebird');
var nconf = require('./config');

bluebird.promisifyAll(Redis.RedisClient.prototype);

if (nconf.get('redis:hostname')) {
  var redis = Redis.createClient(nconf.get('redis:port'), nconf.get('redis:hostname'));
} else {
  var redis = Redis.createClient();
}

if (nconf.get('redis:password')) {
  redis.auth(nconf.get('redis:password'));
}

module.exports = redis;
