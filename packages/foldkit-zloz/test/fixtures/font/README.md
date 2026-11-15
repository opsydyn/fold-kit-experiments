# Inter fixture

`inter-latin-400.ttf` is reconstructed from the existing repository asset
`apps/web/public/models/inter-latin-400-normal.woff` (Inter Latin regular, static).
No tables or glyph data were changed: the WOFF table streams were decompressed
with Python stdlib zlib, assembled as an sfnt directory sorted by tag, four-byte
zero padded, and the whole-file head checksum adjustment recomputed per OpenType.
The sfnt is 67,952 bytes with 15 tables. This literal real-font fixture is independent
of the production validator/encoder. Tests also use its mutations for rejection.

`OFL.txt` is the Inter license from the already installed `@fontsource/inter@5.3.0`.
The fixture and embedded-font evidence SVG redistribute these font bytes under that
license, not the package's MIT license. See the included copyright and OFL terms.
