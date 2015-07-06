
/**
 * Module Dependencies
 */

var resolve = require('../');
var assert = require('assert');
var netrc = require('node-netrc');
var auth = netrc('api.github.com') || {};
var tok = process.env.GH_TOKEN || auth.password;

/**
 * Tests
 */

describe('resolve()', function(){
  it('should resolve a semver version to gh ref', function(done){
    resolve('componentjs/component@0.19.6', { token: tok }, function(err, ref){
      if (err) return done(err);
      assert.equal(ref.sha, 'a15d8d10c4c60429cda4080ffd16f2d408992a6d');
      assert.equal(ref.name, '0.19.6');
      assert.equal(ref.type, 'tag');
      done();
    });
  });

  it('should sort properly', function(done){
    resolve('componentjs/component@0.19.x', function(err, ref){
      if (err) return done(err);
      assert.equal(ref.name, '0.19.9');
      done();
    });
  });

  it('should resolve a branch to gh ref', function(done){
    resolve('componentjs/component@master', function(err, ref){
      if (err) return done(err);
      assert.equal(ref.name, 'master');
      done();
    });
  });

  it('should resolve branches with `/` in them', function(done){
    resolve('cheeriojs/cheerio@refactor/core', function(err, ref){
      if (err) return done(err);
      assert.equal(ref.name, 'refactor/core');
      done();
    });
  });

  it('should default to the latest tag when the ref is `*`', function(done){
    resolve('segmentio/analytics.js@*', function(err, ref){
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  });

  it('should use master when there are no tags and ref is `*`', function(done) {
    resolve('matthewmueller/throttle@*', function(err, ref){
      if (err) return done(err);
      assert.equal(ref.name, 'master');
      done();
    });
  });

  it('should use master when there are no tags', function(done){
    resolve('mnmly/slider', function(err, ref){
      if (err) return done(err);
      assert.equal(ref.name, 'master');
      done();
    });
  });

  it('should provide better errors for invalid repos', function(done) {
    resolve('sweet/repo@amazing/version', function(err){
      assert(err);
      assert(err.message.indexOf('Not Found') > -1);
      done();
    });
  });

  it('should resolve twbs/bootstrap@* quickly', function(done){
    resolve('twbs/bootstrap@*', function(err, ref){
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  });

  it('should resolve renamed repos', function(done) {
    resolve('segmentio/duo', { token: tok }, function(err, ref) {
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  });

  it('should work on weird semvers', function(done){
    resolve('chjj/marked@*', function(err, ref){
      if (err) return done(err);
      assert(/v[.\d]+/.test(ref.name));
      done();
    });
  });

  it('should resolve multiple non-semantic semvers', function(done) {
    resolve('alexei/sprintf.js@*', function(err, ref) {
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  });

  it('should work on weird branches', function(done) {
    resolve('cheeriojs/cheerio@refactor/core', done);
  });
});
