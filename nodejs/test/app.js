process.env['CIRCLECI_TOKEN'] = 'foo';
var request = require('supertest');
var expect = require('chai').expect;
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var circle = require('../lib/circleci');
var app = require('../app').app;
var github = require('../lib/github');

describe('webui', function() {
  before(function() {
    sinon.stub(circle, 'getProjects').resolves([]);
    sinon.stub(github.user, "getTeamsAsync").resolves([]);
  });

  it('renders /', function(done) {
    request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200, done);
  });

  it('starts crawling', function(done) {
    request(app)
      .get('/crawl')
      .expect('Content-Type', /html/)
      .expect(200, done);
  });

  it('handles a github event', function(done) {
    request(app)
      .post('/github-hook')
      .expect(200, done);
  });
});
