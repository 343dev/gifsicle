# Limit the package to single-GIF optimization

Although upstream Gifsicle supports merging, exploding, resizing, frame selection, and many other transformations, this package will expose only optimization of one GIF byte sequence using the `optimize`, `careful`, `colors`, `lossy`, and `gamma` settings used by Optimizt. A narrow contract avoids carrying the upstream CLI’s filesystem and multi-input model into the JavaScript API; unsupported settings will be rejected rather than passed through.
