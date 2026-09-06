# Integrate upstream with a tracked patch

The byte-preserving Gifsicle 1.96 snapshot will remain unchanged. Because upstream has no public in-memory optimization entry point, the build will copy that snapshot to a temporary directory, apply a minimal tracked patch that exposes the required byte-oriented seam, and compile it with the separate bridge. The patch is part of the corresponding source and may expose data and errors but must not alter Gifsicle’s optimization algorithms.
