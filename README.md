# require-watch

[![npm downloads][downloads-image]][downloads-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage Status][coverage-image]][coverage-url]

Require watch wraps around Node's module loader and watches files as they are loaded. If a change is detected on a watched module, then that module, along with all its parents, are automatically flushed from the require cache.

This was primarily motivated in enabling hot reloading for express routes. See below under [Express example](#express-example)

Example usage:

```
import watch from 'require-watch';

watch(require.resolve('lib/some-root'));
```

After this, any changes in `lib/some-root` will automatically flush the require cache. Note that flushing the require cache **still requires code that manually requires the module again**.

## Notes

* You should require and use `require-watch` as early as possible in your application, so that it can properly wrap `Module._load` with its watching mechanisms
* For verbose output of `require-watch`, set `NODE_DEBUG=require-watch`

## Limitations

Although the module is flushed from the require cache, there is no guarantee that it will be reloaded. Calling code is responsible for doing this. For example:

### `index.js`

```
import watch from 'require-watch';
import sayHello from 'lib/hello';

watch(require.resolve('lib/hello'));

setInterval(sayHello, 1000); // this syntax won't be hot reloaded
```

### `lib/sayHello.js`

```
export default function() { console.log('hello'); }
```

If you were to edit `lib/sayHello.js`, there would be no effect. **Instead, you need to introduce a require statement in the calling function:**

### `index.js`

```
setInterval(() => require('lib/sayHello')(), 1000); // this syntax enables hot reloading
```

This is necessary because this module only flushes the require cache - any existing code loaded in memory remains in memory if it is not re-required. **There is no way around this limitation.**

The reason why this revised code works is because the caller, `setInterval` is requesting the module every time from the require cache. There should be minimal performance impact because if a module is already loaded, it is not reloaded from disk.

## Express example

If you originally had some code like this:

```
import express from 'express';

const app = express();

app.get('/', (req, res, next) => {
	// some code you want dynamic
});

app.listen(8080);
```

First extract the router into a separate file:

```
import { Router } from 'express';

const router = Router();

router.get('/', (req, res, next) => {
	// some code you want dynamic
});

export default router;
```

Then update your app entry like this:

```
import express from 'express';
import watch from 'require-watch'; // use the module

const app = express();

watch(require.resolve('./router')); // watch this file
app.use('/', (req, res, next) => require('./router')(req, res, next)); // force reloading

app.listen(8080);
```

What happens is that every WEB request causes a fresh REQUIRE request. If you edit `./router.js`, `require-watch` will invalidate the cache, forcing a reload of the module.

[downloads-image]: https://img.shields.io/npm/dm/require-watch.svg?style=flat-square
[downloads-url]: https://www.npmjs.com/package/require-watch
[travis-image]: https://travis-ci.org/masotime/require-watch.svg?branch=master
[travis-url]: https://travis-ci.org/masotime/require-watch
[daviddm-image]: https://david-dm.org/masotime/require-watch.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/masotime/require-watch
[coverage-image]: https://coveralls.io/repos/github/masotime/require-watch/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/masotime/require-watch?branch=master