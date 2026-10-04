# D3 source reference

The Cartesian slice uses these official source snapshots, restored locally in
ignored `d3-main/` folders for comparison. They are reference source, not runtime
dependencies.

- [d3-scale continuous normalisation](https://github.com/d3/d3-scale/blob/d6904a4bde09e16005e0ad8ca3e25b10ce54fa0d/src/continuous.js): equal domain endpoints normalise to 0.5; the existing `linear` port now projects them to the range midpoint.
- [d3-array histogram](https://github.com/d3/d3-array/blob/be0ae0d2b36ab91b833294ad2cfc5d5905acbd0f/src/bin.js): explicit interior thresholds, right bisection and inclusive final endpoint. The new geometry calls the existing `bin` port with explicit equal-width thresholds so a requested bin count has exact control semantics.
- [d3-shape line](https://github.com/d3/d3-shape/blob/a82254af78f08799c71d7ab25df557c4872a3c51/src/line.js): defined/undefined samples start and end segments. The new geometry calls the existing line port and retains gaps per series.

Automatic constant-domain expansion, layout validation, stable datum keys and
paint/theme contracts are documented library policies above these primitives;
they are not claims of additional D3 API parity.
