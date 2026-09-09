# Isolate each optimization in a fresh Worker

Each optimization will run in a fresh Node.js Worker Thread with its own WebAssembly instance, and the public promise will not settle until the Worker has exited. Gifsicle has mutable global state, while callers such as Optimizt run operations concurrently; per-operation isolation avoids cross-request state and keeps CPU work off the main thread. The package will not add a concurrency queue because callers own concurrency control.
