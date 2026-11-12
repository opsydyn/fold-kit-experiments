# Standalone SVG writer — local qualification, 2026-11-12

Source base: `457c722`, isolated branch `codex/zloz-context-map`; implementation
is in the commit containing this receipt. Decision:
[ADR 0053](../../../docs/adr/0053-write-svg-through-typed-primitives.md). Extends the
[planning contract](svg-export.md).

- **result:** complete
- **claim:** the approved bounded package writer emits standalone canonical SVG
  with shared geometry, ports/labels, themes/background/clipping and typed custom
  adapters. Unsupported content/failures block atomically; losses require explicit
  acknowledgement and uncertainty findings remain attached.
- **evidence:** host-captured root lint/format, workspace typecheck, full workspace
  tests and TypeDoc exited 0. Core: 461 passing tests, including seven writer tests.
  Actual packed Node/Bun consumers compile and execute the public writer. Four real
  SVG files passed Chromium 151.0.7922.34 checks at 1100×760 with zero page errors
  and external requests; captures were inspected locally.
- **remaining uncertainty:** resource-byte embedding, arbitrary markup/CSS/complex
  custom paths, workbench download UI, PNG, broader browser/font/device/manual AT,
  large-model performance, hosted and registry qualification remain open. Fonts,
  nominal bounds and declared custom fidelity remain explicitly unverified. No
  publishing/deployment occurred; Alchemy stays deferred.
- **next:** needs review; then compose package-owned SVG review/download controls
  in the workbench, retaining region/theme/background choices, visible findings and
  loss acknowledgement. Keep PNG and Alchemy deferred.

## Public contract and boundary

`writeSvgExport(snapshot, options, writing)` always rebuilds its plan. It accepts
no pre-approved mutable plan as authority and returns `written` with `svg`, plan
and final findings, or `blocked` without partial SVG. It performs no file/network
or browser IO and preserves source graph, editor, camera and Undo.

Core outline, port and edge geometry drives group/node frames, paths, authored
bends, arrows, labels and ports. Node architecture descriptors become static text.
Generic arrows do not reproduce DDD/EventStorming relationship/side-role notation:
that requires a custom vector adapter or explicit semantic-edge-fallback loss
acknowledgement. This guard was added during self-review and has a regression test.

Adapters bind exact ID/version declarations and receive frozen owned node/edge,
theme/font and endpoint data. They must be pure synchronous host functions, not
sandboxed code, returning non-empty typed primitive arrays in world coordinates.
The vocabulary is rect/circle/line/polygon/polyline/text/translated groups. No raw
markup/path strings, arbitrary attributes, URL paints, CSS or foreignObject are
accepted. Unexpected fields, failed/mutating callbacks, invalid geometry/paint/XML,
empty output and exceeded limits block with item-addressed reasons.

All literal text/identifiers are XML-escaped; unrepresentable characters reject.
Theme/background, viewBox/output size and explicit world clipping follow the fresh
plan. Generic font families retain their meaning; other family names are quoted
as literals. Prefixes are validated for internal references; inline consumers must
supply unique prefixes. System-font substitution and text ink remain unverified.

External/missing resource declarations already block planning. Embedded resource
metadata also blocks this writer because no validated bytes/resource adapter exists.
Nothing is fetched. Defaults are 10,000 drawing primitives, depth 32 and 2,000,000
output UTF-16 code units; these limits do not claim peak-memory or speed guarantees.
Native paths and custom primitives share the drawing budget; fixed infrastructure
is outside that count. Canonical v1 document formats are unchanged.

## Verification and files

```sh
bun test packages/foldkit-zloz/test/svg-writer.test.ts
bun typecheck
bun run test
bun packages/foldkit-zloz/evidence/svg-writer-fixtures.ts
node packages/foldkit-zloz/evidence/svg-writer-browser.mjs
bun run --filter @opsydyn/foldkit-zloz docs
bun run check
```

The first public-API regression failed before implementation. Seven writer tests
cover escaped standalone output, shared paths/ports/labels, unchanged source/history,
matching/missing adapters, callback failure/mutation isolation, explicit losses,
resource rejection, invalid XML including lone surrogates, valid Unicode, injected
fields/URL paints, non-finite geometry, cycles/depth/primitive/output budgets,
duplicate adapters, safe prefixes, empty output and semantic-edge fallback.

Packed fixtures compile positive/negative contracts under Bundler and NodeNext with
exact optional properties, then execute under Node and Bun without UI peers. Raw
markup is a negative public type contract. TypeDoc generates the writer and adapter
contracts. Root tests retain existing warnings/skips; a pass is not manual AT or
all-browser acceptance. Logs are local under `/private/tmp/zloz-svg-writer-*`.

Browser qualification opens actual generated XML, checks parsing/namespace/title,
nested group/node/edge/port counts, escaped labels, positive finite path/text metrics,
custom port positions, full-artboard text bounds, crop dimensions, transparent
background structure, absence of active markup and zero external requests:

| Fixture                            | Actual SVG                        | Browser capture                       |
| ---------------------------------- | --------------------------------- | ------------------------------------- |
| Shared light theme                 | [SVG](svg-writer-light.svg)       | [Capture](svg-writer-light.png)       |
| Shared dark + custom vector person | [SVG](svg-writer-dark-custom.svg) | [Capture](svg-writer-dark-custom.png) |
| Explicit camera crop               | [SVG](svg-writer-viewport.svg)    | [Capture](svg-writer-viewport.png)    |
| Transparent background             | [SVG](svg-writer-transparent.svg) | [Capture](svg-writer-transparent.png) |

PNG files here are browser evidence captures, not a PNG export API. These fixtures
qualify their chosen diagrams and system font environment, not all host rendering.
Architecture/boundary, delivery and test-quality reviews are self-review. Verdict:
**safe with noted risk** for trusted adapter purity, nominal bounds, resource limits
and unqualified large-graph cost. No dependency was added. Rollback before release
is a local commit revert with no data migration.
