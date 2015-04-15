var bluebird = require('bluebird');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

it('tests notifications', function(done) {
  var p = new bluebird.Promise(function(resolve, reject) {

  });
  p.should.notify(done);
});
