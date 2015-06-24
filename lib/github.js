
var base = 'https://api.github.com/';
var path = require('path');
var request = require('request');

module.exports = function (opts) {
  var token = opts.token;

  return {
    tags: tags.bind(null, token),
    branch: branch.bind(null, token)
  };
};

function tags(token, owner, repo, callback) {
  return request({
    url: url('repos', owner, repo, 'tags'),
    qs: { access_token: token },
    json: true,
    headers: {
      'Accept': 'application/vnd.github.quicksilver-preview+json',
      'User-Agent': 'duo:gh-resolve'
    },
    followRedirects: true
  }, handle(callback));
}

function branch(token, owner, repo, branch, callback) {
  return request({
    url: url('repos', owner, repo, 'branches', branch),
    qs: { access_token: token },
    json: true,
    headers: {
      'Accept': 'application/vnd.github.quicksilver-preview+json',
      'User-Agent': 'duo:gh-resolve'
    },
    followRedirects: true
  }, handle(callback));
}

function url() {
  var parts = [].slice.call(arguments);
  return base + path.join.apply(path, parts);
}

function handle(callback) {
  return function (err, res, data) {
    if (err) {
      callback(err, res);
    } else if (isError(res.statusCode)) {
      callback(new Error(data.message));
    } else {
      callback(null, res, data);
    }
  };
}

function isError(code) {
  var type = Math.floor(code / 100);
  return type === 4 || type === 5;
}
