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
  ]);
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
  ]);
};

/**
 * Helper for performing an HTTP GET against the Github API.
 *
 * @param {String} token
 * @param {Array:String} parts  Pieces of the URL
 * @return {Response}
 */

function* get(token, parts, attempts) {
  var uri = url.resolve('https://api.github.com/', parts.join('/'));
  debug('--> GET %s', uri);

  var res = yield request({
    url: uri,
    qs: { access_token: token },
    headers: { 'User-Agent': 'duo:gh-resolve' },
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

  return res;
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
