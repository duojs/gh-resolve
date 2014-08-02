/**
 * Module dependencies.
 */

var debug = require('debug')('gh-resolve');
var tokenizer = require('mini-tokenizer');
var exec = require('child_process').exec;
var fmt = require('util').format;
var enqueue = require('enqueue');
var semver = require('semver');
var satisfies = semver.satisfies;
var compare = semver.compare;
var slice = [].slice;

/**
 * Regexps
 */

var rref = /([A-Fa-f0-9]{40})[\t\s]+refs\/(head|tag)s\/([A-Za-z0-9-_\/\.$!#%&\(\)\+=]+)\n/g;

/**
 * Tokenizer
 */

var tokens = tokenizer(rref, function(m) {
  return { sha: m[1], type: m[2], name: m[3] };
});

/**
 * Expose `resolve`
 */

module.exports = enqueue(resolve, 100);

/**
 * Resolve `slug` with `fn(err, tag)`.
 *
 * @param {String} slug
 * @param {Object} opts (optional)
 * @param {Function} fn
 * @api public
 */

function resolve(slug, opts, fn){
  if (2 == arguments.length) {
    fn = opts
    opts = {};
  }

  // options
  opts.retries = undefined == opts.retries ? 1 : opts.retries;

  var repo = slug.split('@')[0];
  var ref = slug.split('@')[1];
  var url = remote(repo, opts.token);
  var cmd = fmt('git ls-remote --tags --heads %s', url);

  if (!~opts.retries) {
    debug('%s: max retries reached.', slug);
    return fn(error('%s: cannot resolve', slug));
  }

  // execute
  debug('executing: %s', cmd);
  exec(cmd, function(err, stdout, stderr) {
    debug('executed: %s', cmd);
    if (err || stderr) return retry(error(err || stderr));
    var refs = tokens(stdout).sort(arrange);
    var tag = satisfy(refs, ref);
    fn(null, tag);
  });

  function retry(err){
    if (err.message.indexOf('fatal: unable to access')) {
      debug('%s: unable to access, trying again...', slug);
      opts.retries--;
      resolve(slug, opts, fn);
    } else {
      fn(err);
    }
  }
}

/**
 * Get the remote url
 *
 * @param {String} token (optional)
 * @return {String}
 * @api private
 */

function remote(name, token) {
  token = token ? token + '@' : '';
  return fmt('https://%sgithub.com/%s', token, name);
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
  for (var i = 0, ref; ref = refs[i++];) {
    if (equal(ref.name, version)) return ref;
  }
};

/**
 * Arrange the refs
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Number}
 * @api public
 */

function arrange(a, b) {
  var ta = a.type == 'tag';
  var tb = b.type == 'tag';

  // place valid ranges in front
  if (ta && !tb) return -1;
  if (tb && !ta) return 1;

  // compare the semver
  if (ta && tb) {
    return -compare(a.name, b.name);
  }
}

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
 * Create an error
 *
 * @param {String|Error} err
 * @param {Mixed, ...} params
 * @return {Error}
 * @api private
 */

function error(err) {
  err = err || err.message;
  var args = slice.call(arguments, 1);
  var msg = fmt.apply(fmt, [err].concat(args));
  return new Error(msg);
}
