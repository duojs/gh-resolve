/* eslint-disable camelcase */

/**
 * Module dependencies.
 */

var debug = require('debug')('duo:gh-resolve:github');
var request = require('co-request');
var retry = require('co-retry');
var url = require('url');

/**
 * Caching strategy:
 *
 * First, there is an in-memory caching for eliminating repeat requests
 * in the course of a single process. (ie: single build) All it does is
 * store the data requested per-URL so we only GET once.
 *
 * Also, there is the newer duo-cache which handles persisting the cache
 * between builds. This cache stores the retrieved data *as well as* the
 * Etag for the request so it can be used in a conditional request in the
 * next build.
 */

var localCache = {};

/**
 * Retrieve the list of tags for a given repository.
 *
 * @param {String} token
 * @param {Object} options
 * @return {Object}
 */

exports.tags = function* (token, options) {
  var ret = [];
  var page = 1;

  do {
    var list = yield get(token, [
      'repos',
      options.owner,
      options.repo,
      'tags'
    ], options.slug, options.cache, page++);

    ret = ret.concat(list);
  } while (list.length === 100);

  return ret;
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
  ], options.slug, options.cache);
};

/**
 * Helper for performing an HTTP GET against the Github API.
 *
 * @param {String} token
 * @param {Array:String} parts  Pieces of the URL.
 * @param {Cache} cache         The duo-cache instance.
 * @param {Number} attempts     The attempt number (used internally)
 * @param {Number} page         The page number to fetch (only used by tags list)
 * @return {Response}
 */

function* get(token, parts, slug, cache, page) {
  var uri = url.resolve('https://api.github.com/', parts.join('/'));
  var headers = {
    // TODO: remove this on July 21, once repository redirects are enabled by default
    // @see https://developer.github.com/changes/2015-05-26-repository-redirects-are-coming/
    'Accept': 'application/vnd.github.quicksilver-preview+json',
    'User-Agent': 'duo:gh-resolve'
  };
  debug('--> GET %s', uri);

  var localCacheKey = uri;
  if (page) localCacheKey += '?page=' + page;

  if (localCacheKey in localCache) {
    debug('response found in local cache', localCacheKey);
    return localCache[localCacheKey];
  }

  if (cache) {
    debug('checking cache for %s', uri);

    var key = [ 'github', uri ];
    if (page) key.push(page);

    var cached = yield cache.get(key);
    if (cached) {
      debug('%s was found in cache', uri);
      headers['If-None-Match'] = cached.etag;
    }
  }

  var options = {
    url: uri,
    qs: { access_token: token, per_page: 100, page: page },
    headers: headers,
    followRedirects: true,
    json: true
  };

  var res = yield retry(request.bind(null, options), { retries: 5 });
  debug('<-- %s %s', res.statusCode, uri);
  rateLimit(res.headers);

  if (isError(res.statusCode)) {
    var msg = res.body.message;
    debug('error: %s', msg);

    switch (res.statusCode) {
    case 403: // rate-limit exceeded
      throw new Error(msg);

    case 404: // does not exist (or not authenticated)
    default:
      throw new Error('unable to resolve ' + slug);
    }
  }

  if (cache) {
    if (isCached(res.statusCode)) {
      debug('%s has not changed!', uri);
      // update the in-memory cache
      localCache[localCacheKey] = cached.data;
      return cached.data;
    } else {
      debug('caching %s', uri);
      yield cache.put(key, {
        data: res.body,
        etag: res.headers.etag
      });
    }
  }

  // update the in-memory cache
  localCache[localCacheKey] = res.body;

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
