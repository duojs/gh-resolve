
/**
 * Module dependencies.
 */

var conceal = require('conceal');
var debug = require('debug')('duo:gh-resolve');
var github = require('./github');
var parse = require('duo-parse');
var semver = require('semver');
var unyield = require('unyield');

/**
 * Resolve a given `slug` using `options` to define behavior.
 *
 * @param {String} slug
 * @param {Object} options
 * @return {Object}
 */

module.exports = unyield(function* resolve(slug, options) {
  debug('%s: resolving', slug);
  if (!options) options = {};
  var token = options.token || options.password;
  if (token) debug('using token: %s', conceal(token, { start: 6 }));

  var cache = options.cache;
  var parsed = parse(slug);
  if (!parsed.ref) parsed.ref = '*';
  var ref = parsed.ref;

  if (semver.validRange(ref) || semver.valid(ref)) {
    debug('%s: resolving via tags matching', slug, ref);
    return yield tags(token, parsed, cache);
  } else {
    debug('%s: resolving via branch with name', slug, ref);
    return yield branch(token, parsed, cache);
  }
});

/**
 * Resolve a ref via it's list of git tags.
 *
 * @param {String} token
 * @param {Object} parsed
 * @return {Object}
 */

function* tags(token, parsed, cache) {
  var data = yield github.tags(token, {
    slug: parsed.slug,
    owner: parsed.user,
    repo: parsed.repo,
    cache: cache
  });

  var ref = parsed.ref;
  var tag = selectTag(data, ref);

  if (!tag) {
    debug('no valid tags found matching %s', ref);
    if (ref === '*') {
      debug('checking for master branch instead');
      parsed.ref = 'master';
    }

    return yield branch(token, parsed);
  }

  return tag;
}

/**
 * Resolve a ref via it's ref as a branch name.
 *
 * @param {String} token
 * @param {Object} parsed
 * @return {Object}
 */

function* branch(token, parsed, cache) {
  var data = yield github.branch(token, {
    slug: parsed.slug,
    owner: parsed.user,
    repo: parsed.repo,
    branch: parsed.ref,
    cache: cache
  });

  return {
    name: data.name,
    sha: data.commit.sha,
    type: 'branch'
  };
}

/**
 * Accept an array of tags and returns the one that matches
 * the input `ref` semver range.
 *
 * @param {Array:Object} list
 * @param {String} ref
 * @return {Object}
 */

function selectTag(list, ref) {
  var map = indexTags(list);

  var tags = Object.keys(map).filter(function (name) {
    return !!semver.valid(name);
  });

  return map[semver.maxSatisfying(tags, ref)];
}

/**
 * Create a hashmap of the tags in an array.
 *
 * @param {Array:Object} list
 * @return {Object}
 */

function indexTags(list) {
  return list.reduce(function (acc, tag) {
    acc[tag.name] = {
      name: tag.name,
      sha: tag.commit.sha,
      type: 'tag'
    };

    return acc;
  }, {});
}
