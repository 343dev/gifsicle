# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-07

### Changed

- Replaced the native executable-path default export with the asynchronous
  `optimize(input, options)` byte API.
- Replaced six platform-specific executables with one Gifsicle 1.96
  WebAssembly distribution running in a fresh Worker Thread per operation.
- Narrowed the CLI to one GIF and the `optimize`, `careful`, `colors`, `lossy`,
  and `gamma` settings.
- Raised the minimum Node.js version to 22.22.1 and closed package subpaths.
- Made the complete upstream source, tracked integration patch, pinned build
  tooling, and reproducibility materials part of the package.
- Established the reproducible source build as the parity reference. Historical
  lossy output from the old opaque executables can differ from 2.0 output.

### Added

- Stable error codes, strict option validation, parser-time resource limits,
  TypeScript declarations, atomic CLI output replacement, and build/package
  verification commands.

### Removed

- Native OS/CPU selection and full upstream CLI pass-through behavior.

## [1.2.0] - 2026-06-25

### Changed

- Removed the `postinstall` lifecycle script. Platform, CPU architecture, and binary presence are now validated at runtime in `index.js`, so the package no longer relies on install-time scripts (which npm is phasing out).

## [1.1.0] - 2026-01-02

### Changed

- Replaced Linux binaries to work with Alpine Linux without requiring `gcompat` package. The new binaries are built with musl libc compatibility, eliminating the need for glibc compatibility layer on Alpine systems.

## [1.0.0] - 2025-04-11

### Added

- Initial release of the project
