var main = require('../lib/slack');
var chai = require('chai');
var expect = chai.expect;

var ChannelMock = function() {
  var msg = null;
  return {
    send: function(message) {this.msg = message}
  }
};

it('randomly replies to a snack request', function() {
  var mock = new ChannelMock;
  expect(mock.msg).to.be.a('undefined');
  main.do_snack_request(mock);
  expect(mock.msg).to.be.a('string');
});
