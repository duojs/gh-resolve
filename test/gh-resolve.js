
/**
 * Module Dependencies
 */

var assert = require('assert');
var Cache = require('duo-cache');
var netrc = require('node-netrc');
var path = require('path');
var os = require('os');
var resolve = require('../');

/**
 * Local variables.
 */

var auth = netrc('api.github.com') || { token: process.env.GH_TOKEN };
var tmp = path.join(os.tmpdir(), 'duo-cache');

/**
 * Tests
 */

describe('resolve()', function(){
  it('should resolve a semver version to gh ref', function*(){
    var ref = yield resolve('componentjs/component@0.19.6', auth);
    assert.equal(ref.sha, 'a15d8d10c4c60429cda4080ffd16f2d408992a6d');
    assert.equal(ref.name, '0.19.6');
    assert.equal(ref.type, 'tag');
  });

  it('should sort properly', function*(){
    var ref = yield resolve('componentjs/component@0.19.x', auth);
    assert.equal(ref.name, '0.19.9');
  });

  it('should resolve a branch to gh ref', function*(){
    var ref = yield resolve('componentjs/component@master', auth);
    assert.equal(ref.name, 'master');
  });

  it('should resolve branches with `/` in them', function*(){
    var ref = yield resolve('cheeriojs/cheerio@refactor/core', auth);
    assert.equal(ref.name, 'refactor/core');
  });

  it('should default to the latest tag when the ref is `*`', function*(){
    var ref = yield resolve('segmentio/analytics.js@*', auth);
    assert(/[\d.]{3}/.test(ref.name));
  });

  it('should use master when there are no tags and ref is `*`', function*(){
    var ref = yield resolve('matthewmueller/throttle@*', auth);
    assert.equal(ref.name, 'master');
  });

  it('should use master when there are no tags', function*(){
    var ref = yield resolve('mnmly/slider', auth);
    assert.equal(ref.name, 'master');
  });

  it('should resolve twbs/bootstrap@* quickly', function*(){
    var ref = yield resolve('twbs/bootstrap@*', auth);
    assert(/[\d.]{3}/.test(ref.name));
  });

  it('should resolve renamed repos', function*() {
    var ref = yield resolve('segmentio/duo', auth);
    assert(/[\d.]{3}/.test(ref.name));
  });

  it('should work on weird semvers', function*(){
    var ref = yield resolve('chjj/marked@*', auth);
    assert(/v[.\d]+/.test(ref.name));
  });

  it('should resolve multiple non-semantic semvers', function*() {
    var ref = yield resolve('alexei/sprintf.js@*', auth);
    assert(/[\d.]{3}/.test(ref.name));
  });

  it('should work on weird branches', function*() {
    yield resolve('cheeriojs/cheerio@refactor/core', auth);
  });

  it('should work on repos with lots of tags', function*() {
    yield resolve('lodash/lodash@^2.4.1', auth);
  });

  context('errors', function () {
    it('should throw for non-existant repos', function*(){
      try {
        yield resolve('sweet/repo', auth);
        throw new Error('should have failed');
      } catch (err) {
        assert.equal(err.message, 'unable to resolve sweet/repo');
      }
    });

    it('should throw for non-existant repos (even w/ a version)', function*(){
      try {
        yield resolve('sweet/repo@amazing/version', auth);
        throw new Error('should have failed');
      } catch (err) {
        assert.equal(err.message, 'unable to resolve sweet/repo@amazing/version');
      }
    });

    it('should throw for a non-existant tag', function*(){
      try {
        yield resolve('componentjs/component@0.0.0', auth);
        throw new Error('should have failed');
      } catch (err) {
        assert.equal(err.message, 'unable to resolve componentjs/component@0.0.0');
      }
    });
  });

  describe('with cache', function(){
    var goal;
    var cache = new Cache(tmp);
    var options = {
      cache: cache,
      token: auth.token || auth.password
    };

    before(function*(){
      yield cache.initialize();
      var start = new Date().getTime();
      yield resolve('component/each', options);
      var end = new Date().getTime();
      goal = end - start;
    });

    after(function*() {
      yield cache.clean();
    });

    it('should still work', function*() {
      yield resolve('component/each', options);
    });

    it('should go faster', function*(){
      var start = new Date().getTime();
      yield resolve('component/each', options);
      var end = new Date().getTime();
      var time = end - start;
      assert(time <= goal, 'should have been faster than ' + goal + 'ms (actual: ' + time + 'ms)');
    });
  });
});
