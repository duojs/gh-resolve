/**
 * Module dependencies.
 */

var conceal = require('conceal');
var debug = require('debug')('gh-resolve');
var fmt = require('util').format;
var github = require('./lib/github');
var enqueue = require('enqueue');
var parse = require('duo-parse');
var semver = require('semver');

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
  if (arguments.length === 2) {
    fn = opts;
    opts = {};
  }

  var gh = github({ token: opts.token });
  var parsed = parse(slug);
  var ref = parsed.ref || '*';

  // options
  opts.retries = typeof opts.retries === 'undefined' ? 1 : opts.retries;

  // max retries reached
  if (!~opts.retries) {
    debug('%s: max retries reached.', slug);
    return fn(error('%s: cannot resolve', slug));
  }

  // execute
  if (semver.validRange(ref) || semver.valid(ref)) {
    tags(ref);
  } else {
    branch(ref);
  }

  // get version via branch name
  function branch(name) {
    debug('retrieving %s via branch', slug);
    if (opts.token) debug('using token: %s', conceal(opts.token, { start: 6 }));

    gh.branch(parsed.user, parsed.repo, name, function (err, res, data) {
      if (err) return retry(error(err));
      rateLimit(res.headers);

      fn(null, {
        name: data.name,
        sha: data.commit.sha,
        type: 'branch'
      });
    });
  }

  // get version via tags
  function tags(range) {
    debug('retrieving %s via tags', slug);
    if (opts.token) debug('using token: %s', conceal(opts.token, { start: 6 }));

    gh.tags(parsed.user, parsed.repo, function (err, res, data) {
      if (err) return retry(error(err));
      rateLimit(res.headers);
      if (!data.length) return branch('master');

      var tags = data.reduce(function (acc, tag) {
        acc[tag.name] = {
          name: tag.name,
          sha: tag.commit.sha,
          type: 'tag'
        };

        return acc;
      }, {});

      var tagNames = Object.keys(tags).filter(function (name) { return !!semver.valid(name); });
      var tag = semver.maxSatisfying(tagNames, range);
      fn(null, tags[tag]);
    });
  }

  // retry
  function retry(err){
    if (~err.message.indexOf('fatal: unable to access')) {
      debug('%s: unable to access, trying %s more time', slug, opts.retries);
      opts.retries--;
      resolve(slug, opts, fn);
    } else {
      fn(err);
    }
  }
}

/**
 * Get params for github.authenticate()
 *
 * @param {Object} opts
 * @return {Object}
 * @api private
 */

function authenticate(opts) {
  if (opts.token) {
    debug('token auth: %s', conceal(opts.token, { start: 6 }));
    return { type: 'oauth', token: opts.token };
  } else if (opts.username) {
    debug('basic auth: %s / %s', opts.username, conceal(opts.password));
    return { type: 'basic', username: opts.username, password: opts.password };
  } else {
    return false;
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
  err = err.message || err;
  var args = [].slice.call(arguments, 1);
  var msg = fmt.apply(fmt, [err].concat(args));
  return new Error(msg);
}

/**
 * Outputs rate-limit information via debug.
 *
 * @param {Object} headers
 * @api private
 */

function rateLimit(headers) {
  var remaining = headers['x-ratelimit-remaining'];
  var limit = headers['x-ratelimit-limit'];
  var reset = new Date(headers['x-ratelimit-reset'] * 1000);
  debug('rate limit status: %d / %d (resets: %s)', remaining, limit, reset);
}
