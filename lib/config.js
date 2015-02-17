var nconf = require('nconf');
var url = require('url');
var dotenv = require('dotenv');
var bluebird = require('bluebird');

dotenv.load();
nconf.env();

if (nconf.get('DEBUG')) {
  bluebird.longStackTraces();
}

if (nconf.get('REDISCLOUD_URL')) {
  var redisURL = url.parse(process.env.REDISCLOUD_URL);
  nconf.set('redis:port', redisURL.port);
  nconf.set('redis:hostname', redisURL.hostname);
  nconf.set('redis:password', redisURL.auth.split(':')[1]);
  nconf.set('kue:redis', redisURL.port);
  nconf.set('kue:host', redisURL.hostname);
  nconf.set('kue:auth', redisURL.auth.split(':')[1]);
}

if (nconf.get('NODE_ENV') === 'test') {
  nconf.set('kue:prefix', 'test');
}

nconf.defaults({
  redis: {
    port: undefined,
    hostname: undefined,
    password: undefined
  },
  kue: {
    redis: {},
    prefix: undefined
  },
  reviewers: {
    lgtm: {
      threshold: 1
    }
  },
});

module.exports = nconf;
