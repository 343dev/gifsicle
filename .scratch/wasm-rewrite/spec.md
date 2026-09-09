Status: ready-for-agent

# Rewrite `@343dev/gifsicle` as a WebAssembly package

## Problem Statement

`@343dev/gifsicle` currently distributes six platform-specific native executables and exports the selected executable path. Applications such as Optimizt must create a child process for every GIF, stream bytes through standard input and output, and account for operating-system and CPU combinations. This makes the package larger, limits it to an explicit platform allowlist, and leaves the provenance and reproducibility of the existing executables undocumented.

The package also exposes the entire upstream Gifsicle command indirectly even though Optimizt uses only single-GIF optimization with five settings. The current executable-path API cannot provide a portable in-process interface, typed options, stable error categories, bounded resource handling, or deterministic Worker lifecycle.

## Solution

Release `@343dev/gifsicle` 2.0 as a Node.js-only, ESM-only package containing one committed and reproducible WebAssembly build of Gifsicle 1.96. Replace the executable-path export with an asynchronous `optimize` API that accepts one GIF byte sequence and returns the optimized GIF bytes. Support only the `optimize`, `careful`, `colors`, `lossy`, and `gamma` settings used by Optimizt.

Run every optimization in a fresh Worker Thread with a fresh WebAssembly instance. Keep filesystem access and command parsing in Node.js, and expose a narrow, filesystem-free C bridge for the WebAssembly module. Preserve upstream behavior when no settings are supplied, return Gifsicle output even when it is larger than the input, suppress recoverable warnings as Optimizt does today, and expose stable error codes for expected failure categories.

Ship the complete corresponding source, tracked integration patch, bridge, pinned build tooling, notices, and generated distribution in the npm artifact. Installation must not compile or download anything. Verify WebAssembly output against a reproducible native reference, use exact hashes as the normal parity gate, and independently verify playback behavior with a pinned GIF decoder.

## User Stories

1. As an Optimizt maintainer, I want to call Gifsicle with GIF bytes instead of an executable path, so that Optimizt no longer needs a child process for every GIF.
2. As an Optimizt maintainer, I want the API to accept the same five optimization settings Optimizt exposes, so that existing GIF configuration remains meaningful after migration.
3. As an Optimizt maintainer, I want `false` to disable an individual setting, so that existing configuration objects can be passed without a custom filtering adapter.
4. As an Optimizt maintainer, I want omitted settings to remain omitted, so that the package does not silently apply an Optimizt preset.
5. As an API consumer, I want a call without options to behave like Gifsicle 1.96 without optimization flags, so that default behavior is predictable and upstream-aligned.
6. As an API consumer, I want an empty options object to behave like omitted options, so that equivalent calls have equivalent results.
7. As an API consumer, I want partial options to apply only the properties I supplied, so that unrelated transformations are not enabled implicitly.
8. As an API consumer, I want to select optimization levels 0 through 3, so that I can use the optimization levels needed by Optimizt.
9. As an API consumer, I want to enable or disable careful output, so that I can choose compatibility-oriented GIF encoding when required.
10. As an API consumer, I want to reduce the palette to between 2 and 256 colors, so that I can control palette-based optimization.
11. As an API consumer, I want to select a nonnegative integer lossiness value, so that I can use Gifsicle’s lossy optimization behavior.
12. As an API consumer, I want to select numeric, sRGB, or Oklab gamma behavior, so that palette reduction and lossy color comparisons match my intended color space.
13. As an API consumer, I want invalid option names rejected, so that configuration mistakes do not silently change output.
14. As an API consumer, I want invalid option types and ranges rejected without coercion, so that errors are caught before expensive processing begins.
15. As an API consumer, I want to pass a `Buffer` or `Uint8Array`, so that ordinary Node.js binary data works directly.
16. As an API consumer, I want the selected input bytes snapshotted before asynchronous work begins, so that later mutation of my array cannot alter the operation.
17. As an API consumer, I want my input buffer to remain usable and attached, so that calling the optimizer does not unexpectedly transfer ownership of my data.
18. As an API consumer, I want the result as a `Buffer`, so that it integrates directly with Node.js filesystem and stream APIs.
19. As an API consumer, I want Gifsicle’s actual result even if it is larger than the input, so that the package does not conceal or substitute the operation’s output.
20. As an API consumer, I want each operation isolated from other concurrent operations, so that Gifsicle’s mutable global state cannot leak between GIFs.
21. As an API consumer, I want CPU-intensive work off the main thread, so that optimization does not block the application event loop.
22. As an API consumer, I want the returned promise to settle only after its Worker exits, so that no hidden operation or WebAssembly memory remains after `await` completes.
23. As an application owner, I want to control concurrency myself, so that I can choose limits appropriate for my CPU and memory budget.
24. As an application owner, I want no internal package queue, so that package-level scheduling does not conflict with Optimizt’s existing concurrency control.
25. As an API consumer, I want stable error codes for input, options, processing, WebAssembly memory, and Worker failures, so that I can implement reliable recovery and reporting.
26. As an API consumer, I want error messages and causes available for diagnostics without making them stable API, so that maintainers can improve diagnostics without a breaking release.
27. As an API consumer, I want recoverable Gifsicle decoder warnings suppressed while still receiving recovered output, so that behavior matches Optimizt’s current use of `--no-warnings`.
28. As an API consumer, I want irrecoverably invalid GIFs rejected as invalid input, so that corrupt data is not mistaken for a runtime failure.
29. As an application operator, I want oversized encoded input rejected before a Worker performs expensive work, so that input buffering is bounded.
30. As an application operator, I want excessive frame counts rejected during parsing, so that tiny-frame attacks cannot exhaust memory through metadata structures.
31. As an application operator, I want excessive logical canvas area rejected before decompression, so that small encoded GIFs cannot request an enormous canvas.
32. As an application operator, I want excessive total frame area rejected before decompression, so that multi-frame GIFs cannot allocate unbounded pixel storage.
33. As an application operator, I want WebAssembly out-of-memory failures distinguished from invalid-input policy failures, so that runtime exhaustion can be diagnosed accurately.
34. As a CLI user, I want to optimize one GIF from a file or standard input, so that the command remains useful in scripts and at the terminal.
35. As a CLI user, I want output written to a file or standard output, so that both file workflows and pipelines are supported.
36. As a CLI user, I want standard output to contain only GIF bytes, so that piping and redirection remain binary-safe.
37. As a CLI user, I want binary output refused when standard output is an interactive terminal, so that my terminal is not filled with binary data.
38. As a CLI user, I want familiar long-form Gifsicle optimization options, so that the narrow command remains recognizable.
39. As a CLI user, I want `--optimize` without a value to mean level 1, so that Gifsicle’s optional default is preserved.
40. As a CLI user, I want `--lossy` without a value to mean 20, so that Gifsicle’s optional default is preserved.
41. As a CLI user, I want the `--` separator, so that filenames beginning with a hyphen can be addressed unambiguously.
42. As a CLI user, I want duplicate and unknown options rejected, so that ambiguous commands fail instead of being guessed.
43. As a CLI user, I want options to precede operands, so that command parsing is deterministic.
44. As a CLI user, I want `--help` and `--version` to be standalone informational commands, so that their output and exit behavior are unambiguous.
45. As a CLI user, I want `--version` to print `1.96`, so that it reports the embedded Gifsicle version.
46. As a CLI user, I want documented exit statuses, so that shell scripts can distinguish usage, input, filesystem, and runtime failures.
47. As a CLI user, I want an existing output file replaced atomically, so that an interrupted operation does not leave a partial GIF.
48. As a CLI user, I want existing regular-file permissions preserved, so that optimization does not unexpectedly change access controls.
49. As a CLI user, I want symbolic links, directories, and special output files rejected, so that output replacement cannot target unsafe file types.
50. As a CLI user, I want output writability checked before optimization, so that expensive processing does not run when the destination cannot be used.
51. As a CLI user, I want first-signal cleanup and conventional signal exit statuses, so that cancellation removes temporary output and is observable by scripts.
52. As a CLI user, I want a second signal to terminate immediately, so that I can force exit if graceful cleanup stalls.
53. As a package consumer, I want one WebAssembly distribution for supported Node.js environments, so that installation no longer selects among native executables.
54. As a package consumer, I want the package to avoid an operating-system and CPU allowlist, so that compatible Node.js platforms are not rejected arbitrarily.
55. As a package consumer, I want installation to work offline without lifecycle scripts, so that no compiler, SDK, Python, Autotools, or network access is required.
56. As a package consumer, I want no runtime npm dependencies, so that the runtime supply-chain surface remains minimal.
57. As a TypeScript consumer, I want declarations for the optimizer, settings, and error codes, so that invalid calls are caught by the type checker.
58. As a package maintainer, I want internal library, distribution, Worker, source, and bridge modules hidden behind closed package exports, so that implementation details can change safely.
59. As a package maintainer, I want the exact upstream source revision recorded and checksummed, so that the embedded Gifsicle can be audited.
60. As a package maintainer, I want the upstream snapshot kept byte-for-byte unchanged, so that local integration work cannot be confused with upstream source.
61. As a package maintainer, I want the integration modifications represented as a tracked patch, so that changes required for the in-memory seam and resource checks are explicit and reviewable.
62. As a recipient of the GPL-licensed package, I want the complete corresponding source and build materials in the same npm artifact, so that I can inspect and rebuild the distributed WebAssembly.
63. As a package maintainer, I want committed WebAssembly artifacts reproduced byte-for-byte in CI, so that releases do not depend on an unrecorded local build.
64. As a package maintainer, I want a reproducible native Gifsicle reference, so that WebAssembly parity is measured against an auditable baseline.
65. As a package maintainer, I want byte hashes and output sizes fixed for deterministic cases, so that algorithm or toolchain drift blocks a release.
66. As a package maintainer, I want every native/WebAssembly mismatch treated as a release blocker by default, so that regressions are investigated rather than normalized.
67. As a package maintainer, I want any proven parity exception scoped to one input and option set, so that one numerical difference does not weaken unrelated checks.
68. As a package maintainer, I want independently decoded playback compared for lossless behavior and parity exceptions, so that byte-level differences cannot hide a playback regression.
69. As a package maintainer, I want benchmark measurements retained without an initially brittle ratio threshold, so that a stable performance baseline can be established before enforcing one.
70. As an Optimizt maintainer, I want a migration guide showing how to replace `spawn` with the byte API, so that adoption does not require reverse-engineering the new contract.
71. As an Optimizt maintainer, I want the migration guide to remove `--threads` and `--no-warnings`, so that options outside the new contract are not carried forward.
72. As an Optimizt maintainer, I want the historical lossy-output change documented, so that expected byte changes are not mistaken for an unexplained regression.
73. As a maintainer, I want metadata behavior described as Gifsicle behavior rather than a preservation guarantee, so that frame optimization remains free to alter non-playback representation details.
74. As a maintainer, I want the package and new integration code distributed under GPL-2.0-only with required third-party notices, so that licensing remains coherent.

## Implementation Decisions

- The release is version 2.0.0, Node.js-only, ESM-only, and requires Node.js 22.22.1 or later.
- The runtime contract requires Node.js, Worker Threads, and WebAssembly. There is no OS or CPU allowlist. CI guarantees Linux, macOS, and Windows on x64 and ARM64; other compatible environments are permitted but not guaranteed by that matrix.
- The default export and named `optimize` export refer to the same asynchronous function. It accepts one `Buffer` or `Uint8Array`, accepts an optional settings object, and resolves to a `Buffer`.
- The root module also exports the immutable `errorCodes` object. Public declarations define `OptimizeOptions` and the `GifsicleErrorCode` union.
- Package subpaths are closed. The Worker, bridge, generated distribution, vendored source, limits, and internal operation controls are implementation details and are not public exports.
- Input bytes are copied synchronously before the operation yields. The caller’s view is neither modified nor detached.
- Calling the API with no options or an empty object is equivalent to running Gifsicle 1.96 with no optimization flags. There is no implicit Optimizt lossless or lossy preset.
- A partial settings object applies only supplied properties. An omitted property or an explicit `undefined` does not enable that setting.
- `false` disables `optimize`, `colors`, `lossy`, or `gamma`. `careful` is a normal boolean setting.
- `optimize` accepts only integer levels 0 through 3. `colors` accepts only integers 2 through 256. `lossy` accepts only integers 0 through 2,147,483,647. Numeric `gamma` must be finite and greater than zero; string gamma accepts only lowercase `srgb` or `oklab`.
- The options value must be `undefined` or a plain object. Unknown own properties, boxed primitives, coercible strings, non-finite numbers, fractional integer settings, and values outside the declared ranges are rejected.
- The full selected `lossy` range preserves Gifsicle 1.96’s representable C `int` behavior, including defined unsigned wraparound in its internal loss calculation at extreme values. Documentation recommends practical small values but does not invent a smaller API range.
- The optimizer returns Gifsicle’s output regardless of whether it is smaller than the input. Deciding whether to retain a larger result belongs to the caller.
- The package makes no exact metadata-preservation guarantee. Comments, names, frame representation, and application extensions follow Gifsicle 1.96 behavior; playback behavior and native/WebAssembly parity remain tested.
- Recoverable decoder warnings are suppressed and recovered output is returned. An unreadable stream, a stream with no usable frames, a serious decoder failure, or a policy limit violation is invalid input.
- Stable error codes are `INVALID_INPUT`, `INVALID_OPTIONS`, `PROCESSING_FAILED`, `WASM_OUT_OF_MEMORY`, and `WORKER_FAILED`. Error text and causes are diagnostic and are not stable API.
- Expected validation and parser failures are classified before unexpected runtime failures. An unrecognized WebAssembly trap remains a Worker failure until it can be deliberately identified and converted into an expected category.
- Every operation creates a fresh Worker Thread and a fresh WebAssembly instance. The operation result is captured from the Worker, but the public promise does not resolve or reject until Worker exit confirms cleanup.
- The package does not maintain a Worker pool or concurrency queue. Callers own concurrency control.
- The WebAssembly module is filesystem-free. File handling and command parsing stay in Node.js.
- The embedded upstream is the complete archive of Gifsicle tag 1.96 at commit `a08e0f6686d467bb8b9e4715b1f1835f12984fb0`. The snapshot is byte-preserving and retains source modes.
- Upstream provenance includes the source archive SHA-256 and a manifest of every vendored file. Changes to the upstream revision require coordinated provenance, checksum, notice, parity, and native-reference updates.
- Integration uses a minimal tracked patch because Gifsicle 1.96 does not expose a complete in-memory optimization function or its memory writer result. The build copies the pristine snapshot to temporary storage, applies the patch without fuzz, and compiles the patched copy.
- The integration patch exposes the byte-oriented seam, output and error access, and parser-time safety checks. It must not modify optimization algorithms.
- Resource checks occur in the patched Gifsicle parser, avoiding a second JavaScript GIF parser and parser-differential risk. Checks happen before expensive decompression or pixel allocation.
- Encoded input is limited to 128 MiB. A GIF is also rejected if it exceeds 100,000 frames, a logical canvas area of 134,217,728 pixels, or a total frame area of 134,217,728 pixels. Arithmetic is overflow-checked before allocation or narrowing.
- There is no separate public output-size limit. The bridge verifies that output ranges and sizes fit current WebAssembly memory and representable types.
- WebAssembly memory grows on demand with a 4 GiB maximum. A policy-limit rejection is invalid input; inability to allocate or grow the heap is a WebAssembly out-of-memory failure.
- Emscripten 6.0.9 and its emsdk revision are pinned. The generated module is built for Node.js, without Emscripten filesystem support, pthreads, or SIMD, using the agreed release optimization profile.
- The committed distribution contains the generated ECMAScript module and WebAssembly binary. Generated files are never edited manually.
- The canonical native reference is a Linux x64 build of the same source and patch using pinned GCC 14.2.0, `-O3 -DNDEBUG`, with threads and SIMD disabled. Its compiler container or equivalent environment is pinned by immutable digest.
- The existing opaque native executables are not the canonical reference. Their lossy output is known to differ from a fresh reproducible build even though no-options and the Optimizt lossless preset match; this historical difference is documented for migration.
- The CLI optimizes exactly one input. The input operand is required; the output operand is optional and defaults to standard output. `-` denotes standard input or standard output.
- CLI options precede operands. `--` ends option parsing and allows filenames beginning with `-`. Duplicate and unknown options are usage errors.
- The narrow CLI supports `--optimize`, `--optimize=LEVEL`, `--no-optimize`, `--careful`, `--no-careful`, `--colors VALUE`, `--colors=VALUE`, `--no-colors`, `--lossy`, `--lossy=VALUE`, `--gamma VALUE`, `--gamma=VALUE`, `--help`, and `--version`.
- The CLI intentionally does not support `--no-gamma`, `--no-lossy`, `--threads`, `--no-warnings`, short upstream aliases, arbitrary Gifsicle options, multiple inputs, frame selectors, or other upstream command modes.
- Optional values are accepted only with `=`. Bare `--optimize` means level 1 and bare `--lossy` means lossiness 20; the following token remains an operand or separate option. Required values may use `=` or the following token.
- CLI integer syntax is canonical decimal. Gamma supports a positive finite decimal or scientific number and the lowercase names `srgb` and `oklab`. Hexadecimal, `NaN`, `Infinity`, embedded whitespace, trailing junk, and noncanonical named casing are rejected.
- `--help` and `--version` must be used alone. `--version` prints only the upstream version `1.96`.
- CLI standard output contains only GIF bytes during optimization. Diagnostics go to standard error. Binary output is rejected when standard output is a TTY.
- CLI exit statuses are 0 for success/help/version, 1 for invalid GIF or processing failure, 2 for usage/options failure, 3 for filesystem or pipe failure, 4 for Worker/WebAssembly runtime failure, 130 for SIGINT, and 143 for SIGTERM.
- File-output suitability is checked before optimization. Existing output must be a regular file; symbolic links, directories, and special files are rejected. Input and output may refer to the same path.
- File output is written to a unique temporary file in the destination directory, flushed, assigned the existing file’s permission bits or a new mode respecting `umask`, and atomically renamed. Temporary files are removed on failure or interruption.
- The first SIGINT or SIGTERM terminates the active Worker and performs asynchronous cleanup. A second signal exits immediately with the conventional status.
- The package has no runtime npm dependencies. Node.js built-ins and the committed WebAssembly distribution are sufficient at runtime.
- The package has no install, postinstall, prepare, prepack, or other build lifecycle hook. Building and verification are explicit maintainer commands.
- The npm artifact includes the complete upstream snapshot, tracked patch, bridge, reproducible build and verification tooling, generated distribution, public wrapper and declarations, CLI, license, notices, provenance, README, changelog, migration guide, and architecture documentation.
- The package remains GPL-2.0-only. New bridge and wrapper code use the same package license, and notices include applicable Emscripten runtime attribution.
- The migration documentation replaces executable-path imports and child-process piping with direct asynchronous byte optimization. It instructs Optimizt to stop passing `--threads` and `--no-warnings` and explains the known historical lossy-output change.
- This repository does not modify or publish Optimizt. It provides migration instructions and an integration-level test representing Optimizt’s new call pattern.
- Publishing to npm is a separate human action and is not part of implementation.

## Testing Decisions

- Tests prefer the highest public seams. The primary behavioral seam is the root `optimize` API. The second user-facing seam is the installed `gifsicle` CLI process. Build provenance and package contents are release-verification seams rather than alternate runtime APIs.
- Good tests assert observable behavior: returned GIF bytes, stable error codes, process output and status, playback, packaged contents, and reproducibility. They do not assert private helper structure, Worker message internals, allocation strategy, or generated-module implementation details.
- API tests cover both export forms, `Buffer` and sliced `Uint8Array` input, input snapshotting, non-detachment, output type, no-options behavior, empty and partial settings objects, every supported setting, `false` semantics, unknown properties, strict type/range validation, invalid and recoverable GIFs, all resource policies, error-code classification, concurrent isolation, and promise settlement after Worker exit.
- CLI tests execute the command as a process and cover file and stdin input, omitted/file/stdout output, all accepted option forms, optional-value grammar, `--`, unusual filenames, duplicate and unknown options, unsupported upstream options, help, version, binary-clean stdout, stderr diagnostics, TTY refusal where testable, broken pipes, all documented exit classes, same-path input/output, atomic replacement, permission preservation, unsafe output types, preflight failure, temporary-file cleanup, and one- and two-signal behavior.
- The ordinary test suite runs serially where resource-heavy GIF cases could make concurrency unstable. Focused tests may select files, but CI does not increase resource-heavy test concurrency without evidence.
- Ordinary fixtures are committed and small. The suite includes single-frame and animated GIFs; transparency; local and global palettes; comments and application extensions; varied disposal and delays; empty/transparent frames; recoverable trailing garbage; truncated and malformed data; zero dimensions; high frame count; excessive canvas area; excessive total frame area; and boundary-valid cases.
- The parity matrix covers no options; optimization levels 0, 1, 2, and 3; careful enabled and disabled; colors 2, 128, and 256; lossiness 0, 20, and 100 plus selected integer boundaries; gamma 1, 2.2, sRGB, and Oklab; both Optimizt presets; and representative fixture combinations.
- Deterministic parity cases record fixture input SHA-256, options, native output size and SHA-256, and expected WebAssembly output size and SHA-256. A mismatch blocks release by default.
- A parity exception is allowed only for one exact fixture and option set after investigation. Its record contains the input hash, native and WebAssembly sizes and hashes, playback-equivalence evidence, and cause. There is no option-family exemption or generic perceptual tolerance.
- Playback tests use exactly pinned `sharp` 0.35.4 as an independent dev-only decoder. They compare logical canvas dimensions, composited full-frame RGBA bytes, displayed frame count, per-frame delays, and loop count. They do not require identical internal frame rectangles, palettes, disposal encoding, comments, names, or arbitrary extensions.
- Native parity uses the reproducible Linux x64 reference rather than existing vendored executables. A dedicated verification command regenerates outputs from the reference and checks the committed parity manifest.
- Upstream verification checks the exact revision metadata, complete file manifest, byte hashes, executable modes, and absence of unrecorded modifications.
- Patch verification copies the snapshot, applies the tracked patch without offset or fuzz, and fails if the patch no longer applies exactly.
- Distribution verification rebuilds with the pinned Emscripten toolchain in temporary storage and compares both generated artifacts byte-for-byte with the committed distribution. It also rejects embedded repository-specific absolute paths or unexpected debug/source-map artifacts.
- Native-reference verification builds with the pinned GCC profile in an immutable Linux x64 environment and verifies compiler identity and flags before generating parity evidence.
- Benchmarks measure Worker/WebAssembly initialization and representative no-options, lossless, and lossy optimization durations against the native reference. Results include environment, input/output sizes, and options. Initially they are retained as evidence without a hard native-ratio gate.
- Package tests inspect the actual `npm pack` manifest. They require runtime files, declarations, corresponding source, patch, bridge, build tooling, notices, provenance, and user documentation; reject legacy native executables, caches, SDKs, compiler outputs, benchmark inputs, temporary output, and unintended generated files; and verify that no lifecycle hook is present.
- The packed artifact is installed with scripts disabled in a clean temporary project without build tools. Tests invoke both the public API and packaged CLI, and verify that internal subpath imports are rejected.
- CI runs linting, declaration checks, ordinary tests, and installed-package tests on Node.js 22.22.1 and Node.js 24 across the guaranteed platform matrix. Expensive reproducibility, native parity, and benchmark evidence run in separate pinned Linux jobs.
- The existing Guetzli WebAssembly rewrite is prior art for the Worker lifecycle, stable error codes, committed distribution, reproducibility job, parity manifest, atomic CLI output, signal handling, and installed-package tests. This package adapts those patterns to Gifsicle’s single-GIF optimization domain rather than copying Guetzli’s JPEG-specific bridge or limits.

## Out of Scope

- Browser support, browser-specific entry points, CommonJS, WASI as a standalone public product, and raw WebAssembly exports.
- Backward compatibility with the v1 default export that returned a native executable path.
- Keeping the existing six platform-specific executables or any runtime platform-selection logic.
- Full upstream Gifsicle CLI compatibility.
- Multiple input GIFs, merge mode, batch in-place mode, explode modes, frame selection, frame insertion/replacement/deletion, resize and scale, crop, rotate, flip, interlace changes, animation timing edits, transparency edits, metadata-editing options, information modes, gifdiff, and gifview.
- Internal WebAssembly pthreads, the upstream `--threads` option, Worker pools, package-managed concurrency, and a public cancellation API.
- A configurable memory, frame, pixel, input, or output limit.
- Automatically returning the original input when Gifsicle output is larger.
- Exact preservation of comments, names, application extensions, frame rectangles, palette layout, or disposal encoding.
- Treating the existing opaque native executable as the canonical parity reference.
- Generic visual thresholds, broad gamma/Oklab parity exemptions, or accepting arbitrary byte differences based only on approximate appearance.
- Install-time compilation, first-run downloads, remote WebAssembly hosting, or lifecycle hooks.
- Runtime npm dependencies.
- Updating the Optimizt repository in this worktree.
- Publishing the package to npm.
- Introducing a hard WebAssembly/native performance ratio before stable benchmark evidence exists.

## Further Notes

- The design is governed by the accepted ADRs covering the filesystem-free bridge, single-GIF scope, per-operation Worker isolation, corresponding-source distribution, reproducible native reference, exact parity exceptions, tracked upstream patch, committed reproducible distribution, parser-time resource limits, and support for any compatible Node.js platform.
- The canonical vocabulary is “optimization,” “lossless optimization,” and “lossy optimization.” Lossless optimization preserves rendered appearance, timing, and loop behavior, but may change frame boundaries, disposal encoding, and other representation details.
- The agreed test seams were established during design: public API behavior, CLI process behavior, native/WebAssembly parity, independently decoded playback, reproducible builds, and the installed npm artifact. No additional public test-only seam is required.
- The upstream source tag is Gifsicle 1.96 at commit `a08e0f6686d467bb8b9e4715b1f1835f12984fb0`.
- The source archive evidence collected during design includes a GitHub tag archive SHA-256 of `1104b338745f466bdb6b739b152c42a5dfe2fb50a4c21e3bcd78446766f007ea`; implementation must verify and record the exact acquisition method because Git-generated archive bytes can differ from GitHub-generated archive bytes.
- Existing Linux x64 and ARM64 executables produce the same tested lossy output, but a fresh GCC 14.2 source build produces different lossy bytes while matching no-options and Optimizt’s lossless preset. The reproducible source build is authoritative for the new package.
- Implementation must not begin merely because this spec exists; the user explicitly ended design before implementation. A subsequent implementation request may use this ready-for-agent specification.
