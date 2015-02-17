var nconf = require('./config');
var Kue = require('kue');

var kue = Kue.createQueue({
  redis: nconf.get('kue:redis'),
  prefix: nconf.get('kue:prefix')
});

module.exports = kue;
