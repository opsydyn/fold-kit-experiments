# SVG export contract — local qualification, 2026-11-12

Source base: `5d3bdb4`, isolated branch `codex/zloz-context-map`; implementation
is in the commit containing this receipt. Decision:
[ADR 0052](../../../docs/adr/0052-plan-portable-svg-export.md).

- **result:** complete
- **claim:** the approved package-level SVG planning contract is implemented:
  explicit model/camera/world bounds, output scale, shared theme paints/background,
  font/assets and per-item custom-renderer fidelity reporting. This is planning,
  not SVG file generation or complete E3 qualification.
- **evidence:** host-captured root lint/format, workspace typecheck, all workspace
  tests and TypeDoc exited 0. Core: 454 passing tests, including seven focused
  export-contract tests. Actual packed Node/Bun consumers compile and execute the
  new public API without UI peers.
- **remaining uncertainty:** no SVG writer, emitted-file/browser fidelity evidence,
  actual font/asset-byte qualification, PNG, performance, hosted or registry proof
  is claimed. Automatic bounds and renderer/resource declarations retain explicit
  uncertainty findings. Existing warnings/skips remain. No publication/deployment
  occurred; Alchemy stays deferred.
- **next:** needs review; then implement the bounded SVG writer against this
  contract, with escaped text, declared adapters/resources, clipping and representative
  groups/ports/labels/custom-renderer file/browser evidence, before PNG.

## Contract and ownership

Core exports `planSvgExport` plus region/bounds, theme, font/asset, renderer,
findings and plan types. The pure function accepts a canonical `ZlozSnapshot`,
validates/detaches graph/configuration and never changes editor/camera/history.
Required renderer coverage is a host declaration; graph data cannot infer HTML
shells, badges, custom port/edge-label artwork or global host overlays.

Whole-model bounds union authored node/group boxes, authored bends and declared
custom SVG bounds. Padding is explicit, with an unverified-bound finding for text
ink, strokes, port artwork, curves and transient routes. Empty models have a finite
1×1 world artboard. A viewport is a camera crop of the canonical graph; it retains
all nodes/edges so crossing connections are available for clipping. Explicit crops
keep their chosen world rectangle. Scale changes output size, not world coordinates.

Shared light/dark paints resolve without DOM/CSS inheritance. Supported literal
paints and numeric edge width form a smaller explicit contract than all CSS.
Unresolved/unsupported values block with targeted reasons, retaining them for
review rather than inventing replacements. Background is independently theme,
transparent or explicit. Accessible title/description and graph labels remain
literal text for a future writer to escape.

Unknown renderer coverage blocks per item. Named/versioned SVG declarations remain
unverified even when the host declares equivalence; approximations add loss.
Fallbacks, omissions and connections to omitted nodes carry explicit loss reasons.
Omission does not remove graph content or rewrite endpoints. External/missing
resources block; embedded declarations still require byte/glyph/resource validation.
The planner never fetches resources or executes custom renderer/HTML callbacks.

A plan is blocked if any finding is unsupported, otherwise reviewable. Reviewable
is not export authorization, adapter qualification or a file-fidelity claim.
Plans are ephemeral data projections with no graph/snapshot/model wire change.
The later writer must bind declared adapters/resources and validate actual output.

## Verification

```sh
bun test packages/foldkit-zloz/test/svg-export.test.ts
bun run check
bun typecheck
bun run test
bun run --filter @opsydyn/foldkit-zloz docs
```

The initial public-API regression failed before the planner existed. Final focused
suite: seven passing tests and 64 assertions, with literal expected rectangles and
pixel dimensions rather than expectations derived from the implementation.
Coverage includes nested group/node/port/label data, detoured authored bends,
negative coordinates, pan/zoom crop, transparent/custom background, shared dark
palette, empty models, custom bounds/identity, fallback/omission/unknown coverage,
font/assets, invalid/overflowing numbers, duplicate/missing targets, stable finding
order, literal text, detached configuration/graph and unchanged editor/history.

Packed consumer fixtures require explicit renderer coverage and reject unresolved
system theme selection at compile time. They execute the planner against a DDD
aggregate, verify reviewable status/geometry/font uncertainty/transparency and
unchanged Undo under both Node and Bun. TypeDoc generates the public planner and
contracts. Logs are local under `/private/tmp/zloz-svg-*`; fixture installs used
authorized cache/loopback access. No dependency was added.

Architecture/boundary, delivery and test-quality reviews are self-review.
Verdict: **safe with noted risk** for host declaration completeness, nominal bounds
and unqualified large-model copying cost. The boundary preserves package ownership
without browser/IO dependencies. Before release rollback is a local commit revert;
no persisted document migration is required.

**Follow-up delivery:** the bounded standalone writer and actual file/browser
qualification are recorded in the [writer receipt](svg-writer.md). The planning
receipt above retains its original source baseline and scope.
