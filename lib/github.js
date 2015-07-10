/* eslint-disable camelcase */

/**
 * Module dependencies.
 */

var debug = require('debug')('duo:gh-resolve:github');
var request = require('co-request');
var url = require('url');


/**
 * Retrieve the list of tags for a given repository.
 *
 * @param {String} token
 * @param {Object} options
 * @return {Object}
 */

exports.tags = function* (token, options) {
  return yield get(token, [
    'repos',
    options.owner,
    options.repo,
    'tags'
  ], options.cache);
};

/**
 * Retrieve the information about a specific branch for a repository.
 *
 * @param {String} token
 * @param {Object} options
 * @return {Object}
 */

exports.branch = function* (token, options) {
  return yield get(token, [
    'repos',
    options.owner,
    options.repo,
    'branches',
    options.branch
  ], options.cache);
};

/**
 * Helper for performing an HTTP GET against the Github API.
 *
 * @param {String} token
 * @param {Array:String} parts  Pieces of the URL
 * @return {Response}
 */

function* get(token, parts, cache, attempts) {
  var uri = url.resolve('https://api.github.com/', parts.join('/'));
  var headers = { 'User-Agent': 'duo:gh-resolve' };
  debug('--> GET %s', uri);

  if (cache) {
    debug('checking cache for %s', url);
    var key = [ 'github', url ];
    var cached = yield cache.get(key);
    if (cached) {
      debug('%s was found in cache', url);
      headers['If-None-Match'] = cached.etag;
    }
  }

  var res = yield request({
    url: uri,
    qs: { access_token: token },
    headers: headers,
    followRedirects: true,
    json: true
  });

  debug('<-- %s %s', res.statusCode, uri);
  rateLimit(res.headers);

  if (isError(res.statusCode)) {
    var msg = res.body.message;
    debug('error', msg);

    if (msg === 'Not Found' || attempts > 5) {
      throw new Error(msg);
    } else {
      // retry!
      return yield get(token, parts, attempts + 1);
    }
  }

  if (cache) {
    if (isCached(res.statusCode)) {
      debug('%s has not changed!', url);
      return cached.data;
    } else {
      debug('caching %s', url);
      yield cache.put(key, {
        data: res.body,
        etag: res.headers.etag
      });
    }
  }

  return res.body;
}

/**
 * Helper for determining if a status code is an error.
 * (ie: 4xx or 5xx)
 *
 * @param {Number} code
 * @return {Boolean}
 */

function isCached(code) {
  return code === 304;
}

/**
 * Helper for determining if a status code is an error.
 * (ie: 4xx or 5xx)
 *
 * @param {Number} code
 * @return {Boolean}
 */

function isError(code) {
  var type = Math.floor(code / 100);
  return type === 4 || type === 5;
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
