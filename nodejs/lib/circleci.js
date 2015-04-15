var CircleCI = require('circleci');
var nconf = require('./config');

var ci = new CircleCI({
  auth: nconf.get('CIRCLECI_TOKEN')
});

module.exports = ci;
