# Commit a reproducible WebAssembly distribution

The repository will commit `dist/gifsicle.mjs` and `dist/gifsicle.wasm`, and Linux CI will rebuild them with pinned Emscripten 6.0.9 and require byte-for-byte equality. The package will have no build or install lifecycle hooks, so consumers on every supported platform can install and run the same artifacts offline without Autotools, Python, a C compiler, or Emscripten.
