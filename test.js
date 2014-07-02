
var env = process.env;
var resolve = require('./');
var assert = require('assert');
var netrc = require('node-netrc');
var auth = netrc('api.github.com') || {};
var user = env.GITHUB_USERNAME || auth.login;
var tok = env.GITHUB_PASSWORD || auth.password;

describe('resolve()', function(){
  it('should resolve a semver version to gh ref', function(done){
    resolve('component/component@0.19.6', user, tok, function(err, ref){
      if (err) return done(err);
      assert('0.19.6' == ref.name);
      assert('refs/tags/0.19.6' == ref.ref);
      assert('https://api.github.com/repos/component/component/git/tags/6d6501d002aef91f1261f6ec98c6ed32046fe46a' == ref.object.url);
      assert('https://api.github.com/repos/component/component/git/refs/tags/0.19.6' == ref.url);
      assert('6d6501d002aef91f1261f6ec98c6ed32046fe46a' == ref.object.sha);
      assert('tag' == ref.object.type);
      done();
    });
  });

  it('should sort properly', function(done){
    resolve('component/component@0.19.x', user, tok, function(err, ref){
      if (err) return done(err);
      assert('0.19.9' == ref.name);
      done();
    });
  });

  it('should resolve a branch to gh ref', function(done){
    resolve('component/component@master', user, tok, function(err, ref){
      if (err) return done(err);
      assert('master' == ref.name);
      assert('refs/heads/master' == ref.ref);
      assert('https://api.github.com/repos/component/component/git/refs/heads/master' == ref.url);
      done();
    });
  })

  it('should resolve branches with `/` in them', function(done){
    resolve('segmentio/analytics.js-integrations@use/events', user, tok, function(err, ref){
      if (err) return done(err);
      assert('use/events' == ref.name);
      assert('refs/heads/use/events', ref.ref);
      assert('https://api.github.com/repos/segmentio/analytics.js-integrations/git/refs/heads/use/events' == ref.url);
      done();
    })
  })

  it('should default to the latest tag when the ref is `*`', function(done){
    resolve('segmentio/analytics.js@*', user, tok, function(err, ref){
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  })

  it('should use master when there are no tags and ref is `*`', function(done) {
    resolve('yields/uniq@*', user, tok, function(err, ref){
      if (err) return done(err);
      assert('master' == ref.name);
      done();
    });
  })

  it('should provide better errors for invalid repos', function(done) {
    resolve('sweet/repo@amazing/version', user, tok, function(err, ref){
      assert(err);
      assert(~err.message.indexOf('sweet/repo@amazing/version'));
      done();
    });
  })
});
