# require-watch

Require watch wraps around Node's module loader and watches files as they are loaded. If a change is detected on a watched module, then that module, along with all its parents, are automatically flushed from the require cache.

This was primarily motivated in enabling hot reloading for express routes. See below under "Express example"

Example usage:

```
import initWatcher from 'require-watch';

initWatcher('lib/some-root');
```

After this, any changes in `lib/some-root` will automatically flush the require cache. Note that flushing the require cache still requires code that manually requires the module again.

## Notes

* You should require and use initWatcher as early as possible in your application, so that it can properly wrap `Module._load` with its watching mechanisms
* For verbose output of require_watch, set NODE_DEBUG=require-watch

## Limitations

Although the module is flushed from the require cache, there is no guarantee that it will be reloaded. Calling code is responsible for doing this. For example:

### `index.js`

```
import initWatcher from 'require-watch';
import sayHello from 'lib/hello';

initWatcher('lib/hello');

setInterval(sayHello, 1000);
```

### `lib/sayHello.js`

```
export default function() { console.log('hello'); }
```

If you were to edit `lib/sayHello.js`, there would be no effect. Instead, you need to introduce a require statement in the calling function:

### `index.js`

```
setInterval(() => require('lib/sayHello')(), 1000);
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
import initWatcher from 'require-watch'; // use the module

const app = express();

initWatcher('./router'); // watch this file
app.get('/', (req, res, next) => require('./router')(req, res, next)); // force reloading

app.listen(8080);
```

What happens is that every WEB request causes a fresh REQUIRE request. If you edit `./router.js`, `require-watch` will invalidate the cache, forcing a reload of the module.