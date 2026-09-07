# Migrating from 1.x

Version 2 replaces the native executable-path export with an asynchronous byte
API. This is intentionally a breaking change.

Before:

```js
import { spawn } from 'node:child_process';
import gifsiclePath from '@343dev/gifsicle';

const child = spawn(gifsiclePath, ['--optimize=3', '--no-warnings', '--threads=4']);
```

After:

```js
import optimize from '@343dev/gifsicle';
import { readFile, writeFile } from 'node:fs/promises';

const input = await readFile('input.gif');
const output = await optimize(input, { optimize: 3 });
await writeFile('output.gif', output);
```

Remove `--threads`: every call has one fresh Worker Thread, while the caller
controls concurrency across calls. Remove `--no-warnings`: recoverable decoder
warnings are suppressed by the API automatically.

The old opaque native executables are not the parity reference for 2.0. A fresh,
reproducible Gifsicle 1.96 build matches their tested no-options and Optimizt
lossless output, but historical lossy output can differ. The reproducible source
build documented by this package is authoritative.

The bundled CLI is deliberately narrow. It handles one GIF and only the five
optimization settings documented in the README; it is not a replacement for
the complete upstream Gifsicle command.
