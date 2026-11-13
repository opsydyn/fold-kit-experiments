# ADR 0075: Plan retained layout SVG fidelity

## Status

Accepted for the approved headless contract slice, 2026-11-13. Decision owner:
repository maintainer through slice approval. Architecture, boundary, delivery and
test-quality reviews are self-review. Boundary verdict: **safe with noted risk**.

## Context

[ADR 0052](0052-plan-portable-svg-export.md) defines canonical
SVG planning. Layout routes and measured label envelopes live in EditorState,
outside graph serialization. Exporting only the graph loses their placement.
Measured boxes also cannot describe HTML badges, editors, font ink or custom paths.
A contract must separate retained geometry from renderer fidelity before a writer
or PNG adapter consumes it.

## Decision

Core exports `captureSvgLayout(editor, renderKey)`, `ZlozSvgLayoutSnapshot` and
`ZlozSvgLayoutOptions`. Capture requires an idle editor without a label draft,
validates unique existing routes with at least two finite world-space points,
and validates positive finite label boxes and finite extents. It copies routes,
points and boxes and stores exact graph serialization plus a host renderer key.
Partial route coverage is valid; other edges retain canonical geometry.

`planSvgExport` accepts optional `layout: {snapshot, renderKey}`. It compares the
exact exported graph and current key before using retained geometry. Stale evidence
adds blocking `layout-stale`, retains no usable layout, and contributes no bounds.
Current malformed route batches throw the existing invalid-edit error atomically.
Valid layout is detached again into the plan. This is a typed in-process contract,
not an untrusted text decoder, graph wire format or permission token.

Whole-model bounds include effective retained route points and labelled edge
boxes for built-in/fallback renderers. Authored waypoints or explicit pathStyle
retain native geometry precedence and report `layout-route-overridden`. Custom
SVG adapters own their declared bounds; omitted/unsupported artwork does not gain
retained route bounds. Model bounds remain estimated: strokes, port artwork,
font ink, custom geometry and unavailable routes are excluded. Explicit bounds
and viewport crops retain their dimensions. Scale affects output size only.

A retained label box reports `layout-label-content-unverified`: geometry does not
qualify its visual content. Existing per-edge renderer declarations cover paths,
labels, badges and markers together. Hosts must declare a vector adapter, explicit
fallback or omission for custom content; node overrides remain necessary for
custom group headings. No automatic HTML inspection or equivalence claim is made.

The canonical writer adds blocking `layout-writer-unsupported` for any non-empty
opted-in route set, including with allowLosses. It cannot silently ignore the new
plan. Empty captures can use canonical writing. Default options retain canonical
export. Review controls/PNG do not opt in automatically. Writer consumption,
adapter route/label context and emitted-file evidence are the next slice.

## Boundaries, alternatives and consequences

Only headless export planning and writer rejection change. No browser, dependency,
Effect, filesystem or network code enters core. Graph/Undo/history, CLI, review
state and source ownership remain unchanged. No configuration or migration is
needed; new declarations are unreleased. Rollback is a local commit revert.

Deriving geometry from graph alone cannot reproduce retained routes. Serializing
routes into source data would change semantics and persistence. Immediate writer
support would combine an unreviewed label-baseline/adapter policy with planning.
A detached optional snapshot keeps those responsibilities separately reviewable.

The host owns renderKey correctness, including fonts, themes, label content and
custom geometry configuration. Capture cannot discover changes made before it
was called or prove where a box originated. Hosts must invalidate/recompute live
routes when configuration changes, then capture under the new key. Source/key
checks are freshness checks, not attestation. Layout snapshots do not reproduce
collapsed/filtered UI, group headers or unsupplied overlays. Copy/serialization
costs for large models are not performance-qualified.

## Implementation and verification

- `src/svg-layout.ts` owns capture and shared route validation/copying.
- `src/svg-export.ts` owns exact-source/key checks, effective bounds and findings.
- `src/svg-writer.ts` prevents silent canonical fallback; index exports public types.
- Follow existing core errors, stable finding ordering and native geometry precedence.
- [x] Test numeric route/label bounds, authored precedence and fixed crops.
- [x] Test source/key staleness, detachment and malformed batches.
- [x] Test custom SVG/omitted renderer bounds and explicit writer rejection.
- [x] Exercise installed package runtime and TypeScript consumers.
- [x] Run root check, typecheck and full workspace tests.

Evidence and remaining limits are recorded in
[the slice receipt](../assessments/2026-11-13-zloz-svg-layout-contract.md).
No UI changes or new emitted SVG are claimed by this planning slice.
