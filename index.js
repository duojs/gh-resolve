
/**
 * Module dependencies.
 */

var semver = require('semver');
var satisfies = semver.satisfies;
var request = require('request');
var fmt = require('util').format;

/**
 * Github API query
 */

var api = 'https://api.github.com/repos/%s/git/refs/%s?per_page=%s&first';

/**
 * Expose `resolve`
 */

module.exports = resolve;

/**
 * Resolve `repo@version` with `user`, `token` and `fn(err, res)`.
 *
 * @param {String} repo
 * @param {String} user
 * @param {String} token
 * @param {Function} fn
 * @api public
 */

function resolve(repo, user, token, fn){
  var parts = repo.split('@');
  var repo = parts.shift();
  var version = parts.shift() || '*';
  var slug = repo + '@' + version;
  var refs = [];

  var headers = {
    'User-Agent': 'gh-resolve',
    Authorization: basic(user, token)
  };

  function next(url){
    get(url, function(err, res, prev){
      if (err) return fn(err);
      response(res, prev);
    });
  }

  function star(url) {
    get(url, function(err, res) {
      response(res, query(repo, 'heads', 30));
    })
  }

  function get(url, fn){
    request({
      url: url,
      json: true,
      headers: headers,
    }, function(err, res, body){
      if (err) return fn(err);
      return notfound(res.statusCode)
        ? fn(error(slug, res))
        : fn(null, body, parse(res.headers.link));
    });
  }

  function response(res, prev) {
    refs = refs.concat(res);
    var ref = satisfy(refs, version);
    if (ref) ref.name = name(ref);
    if (ref) return fn(null, ref);
    if (prev) return next(prev);
    fn();
  }

  if ('*' == version) {
    // "*"" is a special case.
    // for perf get tags first then heads
    // 30 is the minimum we can fetch
    star(query(repo, 'tags', 30));
  } else if (semver.validRange(version)) {
    // valid semver, only get the tags.
    next(query(repo, 'tags'));
  } else {
    // invalid semver, get the heads.
    next(query(repo, 'heads'));
  }
}

/**
 * Parse the previous `link`.
 *
 * @param {String} link
 * @return {String}
 * @api private
 */

function parse(link){
  return (link || '')
    .split(',')
    .reduce(function(_, link){
      var parts = link.split(';');
      var rel = parts[1];
      if (!~rel.indexOf('last')) return;
      return parts[0].trim().slice(1, -1);
    });
}

/**
 * Satisfy `version` with `refs`.
 *
 * @param {Array} refs
 * @param {String} version
 * @return {Object}
 * @api privae
 */

function satisfy(refs, version){
  refs = normalize(refs.reverse());
  var len = refs.length;

  for (var i = 0; i < len; ++i) {
    var n = name(refs[i]);
    if (n && equal(n, version)) return refs[i];
  }
};

/**
 * Check if the given `ref` is equal to `version`.
 *
 * @param {String} ref
 * @param {String} version
 * @return {Boolean}
 * @api private
 */

function equal(ref, version){
  try {
    return satisfies(ref, version) || ref == version;
  } catch (e) {
    return ref == version;
  }
}

/**
 * Basic auth for `user`, `tok`.
 *
 * @param {String} user
 * @param {String} tok
 * @return {String}
 * @api private
 */

function basic(user, tok){
  return 'Basic ' + new Buffer(user + ':' + tok).toString('base64');
}

/**
 * Error with `res`.
 *
 * @param {String} slug
 * @param {Response} res
 * @return {Error}
 * @api private
 */

function error(slug, res){
  var msg = res.body.message || 'Unknown gh error';
  var err = new Error(slug + ': ' + msg);
  err.res = res;
  return err;
}

/**
 * Name the given `ref`.
 *
 * @param {Object} ref
 * @return {String}
 * @api public
 */

function name(ref){
  var types = ['refs/heads', 'refs/tags'];

  for (var i = 0; i < types.length; ++i) {
    if (0 == ref.ref.indexOf(types[i])) {
      return ref.ref.slice(types[i].length + 1);
    }
  }

  return '';
}

/**
 * Sort and clean the given `refs`
 *
 * @param {Array} refs
 * @return {Array}
 * @api private
 */

function normalize(refs){
  return refs.filter(valid);

  function valid(ref){
    if (!ref) return;
    return 0 == ref.ref.indexOf('refs/tags')
      || 0 == ref.ref.indexOf('refs/heads');
  }
}

/**
 * Query
 *
 * @param {String} repo
 * @param {String} ref
 * @param {String} n
 * @return {String}
 * @api private
 */

function query(repo, ref, n) {
  n = n || 100;
  return fmt(api, repo, ref, n);
}

/**
 * Not found
 *
 * @param {Number} n
 * @return {Boolean}
 * @api private
 */

function notfound(n) {
  n = n / 100 | 0;
  return 4 <= n;
}
