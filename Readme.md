
# gh-resolve

[![npm package](https://img.shields.io/npm/v/gh-resolve.svg)](https://www.npmjs.com/package/gh-resolve)
[![travis build status](https://img.shields.io/travis/duojs/gh-resolve.svg)](https://travis-ci.org/duojs/gh-resolve)

> Resolves a semver version / branch name to git ref.

## resolve(slug, options)

```js
var ref = yield resolve('component/component@0.19.6', { token: token });

ref.name  // 0.19.6
ref.sha   // 6d6501d002aef91f1261f6ec98c6ed32046fe46a
ref.type  // tag
```

This method can be with either `yield` or a `callback`. (thanks to `unyield`)

### Available `options`

 * `token` highly recommended, but not _required_.
 * `password` alias for `token`
 * `cache` a cache instance provided by duo

## License

  (MIT)
