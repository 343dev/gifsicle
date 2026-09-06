# Use a filesystem-free WebAssembly bridge

The package will compile the Gifsicle 1.96 library behind a byte-oriented bridge instead of running the upstream CLI through Emscripten’s virtual filesystem. The package only needs to optimize one in-memory GIF at a time, so keeping argument parsing and filesystem access in Node.js gives the WebAssembly module a smaller, explicit interface and avoids coupling the JavaScript API to Gifsicle’s much broader CLI model.
