
/**
 * Module dependencies.
 */

var spawn = require('child_process').spawn;
var semver = require('semver');
var satisfies = semver.satisfies;
var request = require('request');

/**
 * Expose `resolve`
 */

module.exports = resolve;

/**
 * Resolve `repo@version` with `fn(err, tag)`.
 * 
 * @param {String} repo
 * @param {Function} fn
 * @api public
 */

function resolve(repo, fn){
  var parts = repo.split('@');
  var name = parts.shift();
  var version = parts.shift();
  var url = 'https://github.com/' + name;
  var proc = spawn('git', ['ls-remote', '--tags', '--heads', url]);
  var stdout = '';
  var stderr = '';

  proc.stdout.on('data', function(c){ stdout += c; });
  proc.stderr.on('data', function(c){ stderr += c; });
  proc.on('error', fn);

  proc.on('close', function(code){
    if (code || stderr) return fn(new Error(stderr || 'cannot resolve "' + repo + '"'));
    var refs = parse(stdout, name);
    fn(null, satisfy(refs, version));
  });
}

/**
 * Parse all gh refs.
 * 
 * @param {String} stdout
 * @param {String} repo
 * @return {Array}
 * @api private
 */

function parse(stdout, repo){
  return stdout
    .split(/[\r\n]/g)
    .map(function(line){
      var parts = line.trim().split(/[\t ]+/);
      return {
        ref: parts[1],
        object: { sha: parts[0] }
      };
    })
    .filter(function(ref){
      if (!ref.ref) return;
      ref.name = ref.ref.replace(/^refs\/(heads|tags)\//, '');
      var type = ref.object.type = /^refs\/tags/.test(ref.ref) ? 'tag' : 'commit';
      var baseUrl = 'https://api.github.com/repos/' + repo + '/git';
      ref.object.url = baseUrl + '/' + type + 's/' + ref.object.sha;
      ref.url = baseUrl + '/' + ref.ref;
      return !/\^{}$/.test(ref.name);
    })
    .reverse();
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
