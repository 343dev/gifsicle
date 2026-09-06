# GIF Optimization

This context covers reducing the size of one GIF animation for use by Optimizt while retaining the animation’s intended behavior.

## Language

**Optimization**:
A transformation of one GIF byte sequence into another intended to reduce its encoded size while retaining its playback behavior, except for visual changes explicitly permitted by lossy settings. The encoded frame structure may change.
_Avoid_: Conversion, transcoding

**Lossless optimization**:
Optimization that does not intentionally change the animation’s rendered appearance, timing, or loop behavior. It may change frame boundaries, disposal encoding, and other representation details.
_Avoid_: Compression without qualification

**Lossy optimization**:
Optimization that may alter rendered colors to reduce encoded size while retaining timing and loop behavior. It may also change representation details.
_Avoid_: Degradation, approximation
