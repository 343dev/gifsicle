# @343dev/gifsicle

Node.js WebAssembly API and narrow CLI for single-GIF optimization with
[Gifsicle 1.96](https://www.lcdf.org/gifsicle/).

## Requirements

- Node.js 22.22.1 or later
- ESM

The package has no runtime dependencies, native executables, install scripts,
platform allowlist, or first-run downloads. Every optimization uses a fresh
Worker Thread and fresh WebAssembly instance.

## Installation

```sh
npm install @343dev/gifsicle
```

## API

```js
import optimize from '@343dev/gifsicle';
import { readFile, writeFile } from 'node:fs/promises';

const input = await readFile('input.gif');
const output = await optimize(input, {
	optimize: 3,
	colors: 128,
	lossy: 20,
	gamma: 'srgb',
});
await writeFile('output.gif', output);
```

The named and default `optimize` exports are the same function. Input must be a
`Buffer` or `Uint8Array`; its selected bytes are copied synchronously and caller
storage is not changed or detached. The promise resolves to a Node.js `Buffer`
after the operation's Worker exits. Gifsicle's output is returned even when it
is larger than the input.

Calling `optimize(input)` or `optimize(input, {})` runs the Gifsicle merge/write
pipeline without enabling an optimization setting.

### Options

```ts
interface OptimizeOptions {
	readonly optimize?: false | 0 | 1 | 2 | 3;
	readonly careful?: boolean;
	readonly colors?: false | number; // Integer from 2 through 256
	readonly lossy?: false | number; // Integer from 0 through 2,147,483,647
	readonly gamma?: false | number | 'srgb' | 'oklab';
}
```

Options must be a plain object. Unknown properties, coercible strings, boxed
values, fractional integer settings, non-finite numbers, and out-of-range values
are rejected. Numeric gamma must be greater than zero. Gamma affects color
reduction only when `colors` is enabled. Practical lossy values are generally
small even though the full Gifsicle 1.96 C `int` range is accepted.

### Errors

```js
import { errorCodes } from '@343dev/gifsicle';

try {
	await optimize(input);
} catch (error) {
	if (error.code === errorCodes.INVALID_INPUT) {
		// Invalid GIF or a resource-policy limit.
	}
}
```

Stable codes are `INVALID_INPUT`, `INVALID_OPTIONS`, `PROCESSING_FAILED`,
`WASM_OUT_OF_MEMORY`, and `WORKER_FAILED`. Error messages and causes are
intended for diagnostics and are not a stable interface.

Encoded input is limited to 128 MiB. Parsing also limits GIFs to 100,000 frames,
a 134,217,728-pixel logical canvas, and 134,217,728 total frame pixels. These
policy failures are `INVALID_INPUT`; actual heap exhaustion is
`WASM_OUT_OF_MEMORY`.

Metadata follows Gifsicle behavior. Comments, names, extensions, frame
rectangles, disposal encoding, and palette representation are not guaranteed to
remain byte-identical. Lossless optimization guarantees are verified through
rendered playback, timing, and looping instead.

## CLI

```sh
gifsicle --optimize=3 --colors 128 input.gif output.gif
gifsicle --lossy=20 - - < input.gif > output.gif
```

Exactly one input operand is required. Output defaults to standard output. `-`
denotes standard input or output. Options must precede operands; `--` ends
option parsing.

Supported options:

- `--optimize`, `--optimize=LEVEL`, `--no-optimize`
- `--careful`, `--no-careful`
- `--colors VALUE`, `--colors=VALUE`, `--no-colors`
- `--lossy`, `--lossy=VALUE`
- `--gamma VALUE`, `--gamma=VALUE`
- `--help`, `--version`

Bare `--optimize` means level 1 and bare `--lossy` means 20. Optional values use
`=` only. The CLI rejects duplicate and unsupported options, refuses binary
output to a terminal, and atomically replaces regular output files.

Exit statuses are 0 for success/information, 1 for invalid GIF or processing
failure, 2 for usage, 3 for filesystem or pipe failure, 4 for Worker/WebAssembly
runtime failure, 130 for SIGINT, and 143 for SIGTERM.

This is not the full upstream Gifsicle CLI. Use upstream Gifsicle for merging,
frame editing, resizing, metadata editing, or other command modes.

## Source and reproducible build

The npm artifact includes complete corresponding source and build materials.
See [UPSTREAM.md](UPSTREAM.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

```sh
npm run verify:upstream
npm run verify:patch
npm run setup-emsdk
npm run build:wasm
npm run verify:dist
npm run build:native
npm run verify:native-sanitizers
npm run verify:parity
npm run benchmark
```

Emscripten 6.0.9 and its emsdk commit are pinned. Building is a maintainer action;
package installation never invokes these commands. Native parity uses the Linux x64
GCC 14.2.0 environment documented in `verification/native-reference.md`; set
`GIFSICLE_NATIVE` to that build before running parity or benchmarks. The committed
parity manifest records exact native and WebAssembly sizes and hashes. Benchmark
measurements in `verification/benchmark.json` retain startup-inclusive no-options,
lossless, and lossy baselines without enforcing a performance ratio.

See [MIGRATION.md](MIGRATION.md) when updating from the 1.x executable-path API.
