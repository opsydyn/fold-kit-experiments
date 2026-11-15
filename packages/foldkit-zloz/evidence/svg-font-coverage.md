# Default glyph-coverage qualification

- **result:** complete
- **claim:** headless default Unicode glyph coverage checks the embedded face and
  emitted SVG text. Known absent mappings are explicit losses requiring existing
  exact-artifact acceptance; malformed selected maps block and unknown mappings or
  sequence controls remain unverified. Editor, Undo and wire documents are unchanged.
- **evidence:** tests use the real licensed Inter fixture and independently authored
  format 4/12 tables. Direct delta/range offsets, zero holes, supplementary scalars,
  map precedence without unions, bounds/order/glyph failures, unknown formats,
  limits/surrogates, metadata/omissions/ports/edges/architecture/custom text, host byte
  mutation and review acceptance are exercised. A reproduced omitted-item leakage
  regression failed before correction. Packed consumers exercise Unicode coverage
  under Node/Bun without browser peers. Root `bun typecheck`, final package
  typecheck, `bun run check` and `bun run test` exit 0. Core has 486 passing
  tests, including 10 new coverage tests; the workbench has 106. The entire
  workspace suite has no failures. `bun run --filter @opsydyn/foldkit-zloz docs`
  exits 0 and emits the new public coverage function/result pages. See the [repeatable generator](svg-font-coverage-fixture.ts)
  and [actual findings](svg-font-coverage.json): U+6F22 and U+1F600 are losses in
  the selected Inter face, with output blocked before acceptance and written after.
  Regenerating the existing embedded-font SVG with current code produces identical
  bytes to the committed, browser-qualified artifact; no new browser result is claimed.
- **remaining uncertainty:** default cmap mapping is not shaping, ligature/variation
  behavior, fallback discovery, combining-mark placement, browser rendering, ink bounds
  or a font sanitizer. Fonts remain trusted host resources. Other profiles/formats
  and default-ignorable sequences stay unverified. End-to-end resource/performance,
  other browsers and manual AT remain unqualified. No font import UI, PNG, Alchemy,
  hosted deployment or publication is introduced. Architecture/boundary, delivery and
  test reviews are self-review, with these format/renderer-selection limitations.
- **next:** needs review — return to core completion criteria with strict portable
  review-packet decoding and validation, so generated review packets can be reopened
  safely as read-only artifacts. Keep PNG and Alchemy deferred.

See [ADR 0056](../../../docs/adr/0056-report-default-glyph-coverage-for-emitted-text.md).
