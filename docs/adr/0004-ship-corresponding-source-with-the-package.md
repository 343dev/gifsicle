# Ship corresponding source with the package

The npm package will include the compiled WebAssembly distribution together with the complete `git archive` snapshot of Gifsicle 1.96, the tracked integration patch, bridge, reproducible build scripts, GPL-2.0 license, notices, provenance, and checksums. Keeping the corresponding source in the same artifact is preferable to relying on an external repository for this GPL-licensed binary, while consumers still install and run entirely from committed artifacts without compilation or network downloads.
