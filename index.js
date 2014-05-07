
/**
 * Module dependencies.
 */

var satisfies = require('semver').satisfies;
var request = require('request');

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

  var headers = {
    'User-Agent': 'gh-resolve',
    Authorization: basic(user, token)
  };

  function next(url){
    get(url, function(err, res, prev){
      if (err) return fn(err);
      var ref = satisfy(res, version);
      if (ref) ref.name = name(ref);
      if (ref) return fn(null, ref);
      if (prev) return next(prev);
      fn();
    });
  }

  function get(url, fn){
    request({
      url: url,
      json: true,
      headers: headers,
    }, function(err, res, body){
      if (err) return fn(err);
      var s = res.statusCode / 100 | 0;
      if (4 <= s) return fn(error(res));
      fn(null, body, parse(res.headers.link));
    });
  }

  next('https://api.github.com/repos/' + repo + '/git/refs?per_page=100&last')
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
  for (var i = 0; i < refs.length; ++i) {
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
 * @param {Response} res
 * @return {Error}
 * @api private
 */

function error(res){
  var err = new Error(res.body.message || 'Unknown gh error');
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
