# @343dev/gifsicle

[![npm](https://img.shields.io/npm/v/@343dev/gifsicle.svg)](https://www.npmjs.com/package/@343dev/gifsicle)

[gifsicle](https://www.lcdf.org/gifsicle/) binary wrapper for Node.js

Supported:
- OS platform: `darwin`, `linux`, `win32`.
- CPU architecture: `arm64`, `x64`.

## Introduction

Gifsicle manipulates GIF image files. Depending on command line options, it can merge several GIFs into a GIF animation; explode an animation into its component frames; change individual frames in an animation; turn interlacing on and off; add transparency; add delays, disposals, and looping to animations; add and remove comments; flip and rotate; optimize animations for space; change images' colormaps; and other things.

## Usage

Install:

```sh
npm i -g @343dev/gifsicle
```

Use:

```sh
gifsicle --optimize=2 --colors=128 --lossy=40 gif-not-optimized.gif > optimized.gif
```

## Notes

**gifsicle** normally processes input GIF files according to its command line options and writes the result to the standard output.

**gifsicle**’s command line consists of GIF input files and options. Most options start with a dash `-` or plus `+`; frame selections, a kind of option, start with a number sign `#`. Anything else is a GIF input file.

**gifsicle** reads and processes GIF input files in order. If no GIF input file is given, or you give the special filename `-`, it reads from the standard input.

**gifsicle** exits with status `0` if there were no errors and status `1` otherwise.

[Read the gifsicle man page](https://www.lcdf.org/gifsicle/man.html)
