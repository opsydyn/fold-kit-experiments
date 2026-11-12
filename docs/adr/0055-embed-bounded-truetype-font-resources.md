# ADR 0055: Embed structurally validated TrueType font resources

## Status and scope

Accepted for the approved standalone SVG font-resource contract, 2026-11-12.
Extends [ADR 0053](0053-write-svg-through-typed-primitives.md) and
[ADR 0054](0054-review-svg-before-host-download.md). Architecture/boundary,
delivery and test-quality reviews are self-review: safe with noted risk.
No new dependency, wire format, IO, font discovery, PNG or Alchemy is introduced.

## Decision

Add `ZlozSvgFontResource` with an asset ID, explicit `truetype` format and host-owned
`Uint8Array` bytes. `validateSvgFontResource` returns a discriminated structural
validation result, including precise failure codes/reasons. `writeSvgExport` accepts
`fontResources` and an optional per-font byte budget. It revalidates current bytes,
never accepts a caller's previous validation result as authority, and returns no
partial SVG if a resource fails. A byte copy isolates serialization from host mutation.

Only the selected `font.assetId`, declared as an embedded font asset, may bind a
resource. Missing, duplicate, unreferenced, malformed, over-budget or unsupported
resources block with asset-targeted findings. Images and stylesheets remain unsupported.
Single-face TrueType sfnt is the bounded initial format. WOFF/WOFF2, collections,
CFF, variable and color/bitmap font tables are unsupported in this slice.

Validate file/directory bounds, unique sorted tags, four-byte table alignment,
non-overlap, required table lengths, per-table and whole-file checksums, head magic,
units-per-em, glyph count, horizontal metric counts and monotonic outline locations.
Checks follow the [OpenType file specification](https://learn.microsoft.com/en-us/typography/opentype/spec/otff),
[head](https://learn.microsoft.com/en-us/typography/opentype/spec/head) and
[maxp](https://learn.microsoft.com/en-us/typography/opentype/spec/maxp) and
[OS/2](https://learn.microsoft.com/en-us/typography/opentype/spec/os2) tables.
Reject restricted and bitmap-only embedding flags. Host remains responsible for
permission to distribute the chosen font; flags alone are not a license grant.

This is container/header validation, not a full font sanitizer: glyph programs,
layout tables, shaping, glyph coverage and browser decoding remain unverified.
Only trusted host font bytes belong here; no arbitrary downloaded font ingestion
is added. Keep unverified findings with accurate post-validation reasons.

Embed copied bytes as a generated `data:font/ttf;base64` URL in a package-owned
`@font-face`, using a generated family based on the validated XML prefix. Raw family
strings, font metadata, URLs and CSS are never interpolated into the style block.
The face uses its declared normal weight, with synthetic variants/metrics still
unverified. The existing SVG output budget includes the embedded data. Exact SVG
review identity already includes font bytes via output; changed resources invalidate
approval and failed resources can never be overridden by loss acceptance.

## Alternatives and consequences

Compressed formats would require decompression/format tooling and a larger dependency
or trust contract. Signature-only validation would overstate confidence. A full
font sanitizer is outside this package's current responsibility; the bounded structural
contract makes the remaining trust explicit and permits a later adapter decision.
Costs include larger SVG files, normal-face-only selection, conservative format
rejections and future compatibility duties for the new public types.

## Implementation and verification

Add peer-free `svg-font.ts`, writer options/findings, core exports and API docs.
Use a real licensed Inter fixture reconstructed from the existing WOFF asset with
unchanged tables. Test exact embedding, malformed/truncated/checksum/bounds failures,
unsupported formats, size limits, asset binding, mutation/revalidation and retained
findings. Qualify actual browser font decoding separately from structural validation.
Run root typecheck, lint/format, tests, packed consumers and TypeDoc sequentially
where builds share dist output. Rollback before publication is a local commit revert
with no document migration. PNG and Alchemy remain deferred.

Simplicity check: the outcome is portable font bytes with honest validation findings.
Options checked were compressed-font tooling, full sanitization and bounded sfnt
validation. The selected path keeps IO and discovery in the host and rendering in
the consumer. Checksums, byte/output limits, current-resource checks and immutable
serialization remain required. Broader formats and UI are omitted; glyph semantics
and cross-browser behavior remain uncertain.
