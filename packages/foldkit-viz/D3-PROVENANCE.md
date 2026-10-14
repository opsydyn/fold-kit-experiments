# D3 source reference

## Orthographic globe

`shape/globe` references d3-geo at immutable commit
`8c53a90ae70c94bace73ecb02f2c792c649c86ba`:
[rotation](https://github.com/d3/d3-geo/blob/8c53a90ae70c94bace73ecb02f2c792c649c86ba/src/rotation.js),
[orthographic projection](https://github.com/d3/d3-geo/blob/8c53a90ae70c94bace73ecb02f2c792c649c86ba/src/projection/orthographic.js),
[circle clipping](https://github.com/d3/d3-geo/blob/8c53a90ae70c94bace73ecb02f2c792c649c86ba/src/clip/circle.js),
and their Cartesian/math helpers. The complete source and licence are retained
locally under ignored `d3-main/d3-geo/`; no D3 runtime is installed.
The port keeps spherical rotation and hemisphere visibility and specialises
the great-circle/plane intersection to the hemisphere plane x=0. Its tolerance,
validation and antipodal rejection are explicit library policies. It provides
points and sampled open-line clipping only, not general D3 polygon/stream parity.

The Cartesian slice uses these official source snapshots, restored locally in
ignored `d3-main/` folders for comparison. They are reference source, not runtime
dependencies.

- [d3-scale continuous normalisation](https://github.com/d3/d3-scale/blob/d6904a4bde09e16005e0ad8ca3e25b10ce54fa0d/src/continuous.js): equal domain endpoints normalise to 0.5; the existing `linear` port now projects them to the range midpoint.
- [d3-array histogram](https://github.com/d3/d3-array/blob/be0ae0d2b36ab91b833294ad2cfc5d5905acbd0f/src/bin.js): explicit interior thresholds, right bisection and inclusive final endpoint. The new geometry calls the existing `bin` port with explicit equal-width thresholds so a requested bin count has exact control semantics.
- [d3-shape line](https://github.com/d3/d3-shape/blob/a82254af78f08799c71d7ab25df557c4872a3c51/src/line.js): defined/undefined samples start and end segments. The new geometry calls the existing line port and retains gaps per series.

Automatic constant-domain expansion, layout validation, stable datum keys and
paint/theme contracts are documented library policies above these primitives;
they are not claims of additional D3 API parity.

- [d3-array ticks](https://github.com/d3/d3-array/blob/be0ae0d2b36ab91b833294ad2cfc5d5905acbd0f/src/ticks.js): integer/reciprocal tick increments preserve numeric precision independently of label formatting, including short epoch-millisecond domains. Non-finite tick specifications yield no ticks rather than allocate invalid arrays.

The Cartesian boundary rejects non-finite generated curve paths and generated
histogram thresholds that cannot be represented distinctly inside a non-zero
span. Explicit equal histogram domains retain a single zero-width interval.
