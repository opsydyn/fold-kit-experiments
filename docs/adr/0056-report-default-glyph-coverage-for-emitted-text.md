# ADR 0056: Report default glyph coverage for emitted SVG text

## Status and scope

Accepted for the approved headless glyph-coverage slice, 2026-11-12. Extends
[ADR 0055](0055-embed-bounded-truetype-font-resources.md). Architecture/boundary,
delivery and test-quality reviews are self-review: safe with noted risk.
No dependency, IO, graph wire format, font discovery, PNG or Alchemy is introduced.

## Decision

Expose `inspectSvgFontCoverage(resource, text, { maxBytes?, maxCharacters? })`.
Validate and own one font-byte snapshot using the existing resource boundary.
The public result is `checked`, `unverified` or `invalid`. Checked results include
unique sorted missing/unverified scalar arrays, a default mapping format and the
unique checked scalar count. They never imply shaping or successful browser rendering.

Select one Unicode cmap consistently, preferring full-repertoire mappings over BMP
mappings and Windows records over equivalent Unicode-platform records. Do not union
maps: doing so could hide absent mappings in the selected repertoire. Support formats
4 and 12 with the corresponding BMP/full-repertoire encoding profile; report other
profiles/formats as unverified. Check record/subtable bounds, segment/group ordering,
non-overlap, format 4 relative glyph-array offsets and modulo delta rules, terminal
missing-glyph segment, Unicode limits and glyph indices against maxp. Malformed
selected mappings block. Follow the [OpenType cmap specification](https://learn.microsoft.com/en-us/typography/opentype/spec/cmap).

Default glyph zero means missing. Iterate Unicode scalars (supplementary characters
are one scalar); reject unpaired surrogates. Ignore CR/LF/tab layout delimiters.
Default-ignorable scalars, including joiners and variation selectors, are unverified
rather than automatically missing. Layout/shaping, sequences, font fallback,
combining-mark placement, synthetic variants and ink bounds remain unqualified.
Default text budget is 2,000,000 UTF-16 code units, configurable with a positive
safe-integer `maxCharacters`; existing font-byte limits apply before copying.

The writer checks text primitives actually emitted, including canonical architecture
metadata, ports, edges and nested custom adapter primitives. It ignores omitted
items, replaced canonical labels, root title/description metadata and editor chrome.
Capture text per item and reset before each item; omitted items inherit no state.
One font snapshot feeds both embedded bytes and the cmap checker, so host adapter
mutation cannot substitute a different coverage source halfway through writing.

Add target-specific `font-glyph-missing` loss findings, with structured `codePoints`.
Known losses require the existing explicit loss acceptance. Unknown mappings or
sequence controls produce `font-coverage-unverified`; malformed mappings produce
`font-cmap-invalid` unsupported findings. Text budget/scalar errors are unsupported.
Reasons show up to 16 scalars; structured arrays retain all reported scalars. Existing
exact-byte/findings review identity binds these findings; no separate consent state
is introduced. System fonts remain unverified because no bytes are supplied.

## Alternatives and consequences

Scanning graph labels would miss adapter text and report omitted labels incorrectly.
Browser font measurement would couple headless core to the host and still not prove
fallback identity. Full shaping or all cmap formats would expand the font-engine
scope. A bounded default-mapping checker is reusable, deterministic and honest about
its limits. Format 4 validation examines at most the BMP repertoire; format 12 validates
bounded groups and binary-searches lookups. Whole-workflow performance remains unqualified.

## Implementation and verification

Add `svg-font-coverage.ts`, an internal owned-font preparation function, public
result/function exports and writer findings. Keep browser/Effect peers out of core.
Test the real licensed Inter fixture plus independently authored format 4/12 maps,
zero holes/deltas, supplementary scalars, map precedence, invalid offsets/order/glyphs,
unknown formats, layout/sequence handling, metadata/omissions/adapter/port/edge/architecture
text and exact-artifact acceptance. Reproduce omitted-item leakage before correcting
it. Exercise packed Node/Bun consumers; run root typecheck, lint/format, tests and
TypeDoc with shared-dist builds sequential. Keep original font browser qualification
separate from coverage evidence. Rollback before publication is a local revert without
migration. PNG and Alchemy remain deferred.
