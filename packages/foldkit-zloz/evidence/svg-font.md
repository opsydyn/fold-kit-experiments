# Embedded TrueType resource qualification

- **result:** complete
- **claim:** trusted host TrueType resources have a peer-free structural validation
  contract, bounded standalone SVG embedding and explicit asset-targeted failures.
  Invalid resources cannot be loss-accepted; changed bytes invalidate SVG review
  consent. No document, editor or Undo mutation is introduced.
- **evidence:** literal licensed Inter fixture, exact base64 assertions, original
  missing-API test failure, checksum-corruption and independently repaired-checksum
  cases exercise bounds, overlap, header/metric/location consistency and flags.
  Missing/duplicate/unexpected resources, unsupported signatures/tables/formats,
  byte/output limits, mutable byte views, CSS isolation and review freshness are
  covered. Packed consumers exercise the exported contract without browser peers.
  Root `bun typecheck`, the final core package typecheck, `bun run check` and
  `bun run test` exit 0. Core has 476 passing tests; workbench has 106; the
  complete workspace suite has no failures. `bun run --filter @opsydyn/foldkit-zloz docs`
  exits 0 and includes the new public font contracts. See the repeatable [fixture generator](svg-font-fixture.ts)
  / [browser check](svg-font-browser.mjs). Chromium 151.0.7922.34 loads the actual
  embedded face (`zloz-export-font`, status `loaded`), parses standalone SVG and
  reports zero page errors or external requests. The emitted file contains the
  real 67,952-byte static Inter face with 15 sfnt tables.
- **remaining uncertainty:** this validates sfnt container/header structure, not
  glyph programs, layout tables or font security. Trusted distributable fonts are
  required; embedding flags are not a license grant. Coverage, shaping, synthetic
  variants, wrapping, ink bounds, other browsers, manual AT and large-model/resource
  cost remain unqualified. No WOFF/WOFF2, collections, variable/CFF/color/bitmap
  formats, font discovery/import UI, image/style resources, PNG, Alchemy, hosted
  deployment or publishing are claimed. Architecture/boundary, delivery and test
  reviews are self-review, with the stated trust and format limitations.
- **next:** needs review — add headless glyph-coverage findings for exported text so users
  see potential missing-glyph substitution before download. Keep PNG and Alchemy deferred.

[Standalone SVG](svg-font-embedded.svg) · [Browser capture](svg-font-embedded.png) ·
[Fixture provenance and OFL](../test/fixtures/font/README.md) ·
[ADR 0055](../../../docs/adr/0055-embed-bounded-truetype-font-resources.md)

The PNG is evidence of browser rendering, not a product PNG export feature.
