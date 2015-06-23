/**
 * Module dependencies.
 */

var conceal = require('conceal');
var debug = require('debug')('gh-resolve');
var fmt = require('util').format;
var enqueue = require('enqueue');
var parse = require('duo-parse');
var semver = require('semver');
var GitHub = require('github');

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

  var gh = new GitHub({ version: '3.0.0', debug: false });
  var auth = authenticate(opts);
  if (auth) gh.authenticate(auth);

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
    debug('retrieving %s via branch %s', slug);

    var msg = {
      user: parsed.user,
      repo: parsed.repo,
      branch: name
    };

    gh.repos.getBranch(msg, function (err, data) {
      if (err) return retry(error(JSON.parse(err.message)));
      if (data && data.meta) rateLimit(data.meta);

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

    var msg = {
      user: parsed.user,
      repo: parsed.repo
    };

    gh.repos.getTags(msg, function (err, data) {
      if (err) return retry(error(JSON.parse(err.message)));
      if (data && data.meta) rateLimit(data.meta);
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
 * @param {Object} meta
 * @api private
 */

function rateLimit(meta) {
  var remaining = meta['x-ratelimit-remaining'];
  var limit = meta['x-ratelimit-limit'];
  var reset = new Date(meta['x-ratelimit-reset'] * 1000);
  debug('rate limit status: %d / %d (resets: %s)', remaining, limit, reset);
}
