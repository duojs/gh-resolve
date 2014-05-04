
## gh-resolve

  Resolves a semver version / branch name to git ref.

## Example

```js
resolve('component/component@0.19.6', user, tok, function(err, ref){
  if (err) return done(err);
  assert('0.19.6' == ref.name);
  assert('refs/tags/0.19.6' == ref.ref);
  assert('https://api.github.com/repos/component/component/git/tags/6d6501d002aef91f1261f6ec98c6ed32046fe46a' == ref.object.url);
  assert('https://api.github.com/repos/component/component/git/refs/tags/0.19.6' == ref.url);
  assert('6d6501d002aef91f1261f6ec98c6ed32046fe46a' == ref.object.sha);
  assert('tag' == ref.object.type);
  done();
});
```

## License

  (MIT)
