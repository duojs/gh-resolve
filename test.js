
var resolve = require('./');
var assert = require('assert');

describe('resolve()', function(){
  it('should work on private repos', function(done){
    resolve('component/duo@*', function(err, ref){
      if (err) return done(err);
      assert(ref);
      done();
    });
  })

  it('should resolve a semver version to gh ref', function(done){
    resolve('component/component@0.19.6', function(err, ref){
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
    resolve('component/component@0.19.x', function(err, ref){
      if (err) return done(err);
      assert('0.19.9' == ref.name);
      done();
    });
  });

  it('should resolve a branch to gh ref', function(done){
    resolve('component/component@master', function(err, ref){
      if (err) return done(err);
      assert('master' == ref.name);
      assert('refs/heads/master' == ref.ref);
      assert('https://api.github.com/repos/component/component/git/refs/heads/master' == ref.url);
      done();
    });
  })

  it('should resolve branches with `/` in them', function(done){
    resolve('segmentio/analytics.js-integrations@fix/km-tests', function(err, ref){
      if (err) return done(err);
      assert('fix/km-tests' == ref.name);
      assert('refs/heads/fix/km-tests', ref.ref);
      assert('https://api.github.com/repos/segmentio/analytics.js-integrations/git/refs/heads/fix/km-tests' == ref.url);
      done();
    })
  })

  it('should default to the latest tag when the ref is `*`', function(done){
    resolve('segmentio/analytics.js@*', function(err, ref){
      if (err) return done(err);
      assert(/[\d.]{3}/.test(ref.name));
      done();
    });
  })

  it('should error when the repository is not found', function(done){
    resolve('a/b@*', function(err){
      assert(err && /github\.com\/a\/b/.test(err.message));
      done();
    })
  })
});
