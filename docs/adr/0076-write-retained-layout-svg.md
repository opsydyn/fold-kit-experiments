# ADR 0076: Write retained layout SVG with explicit review opt-in

## Status

Accepted for the approved writer/workbench slice, 2026-11-13. Architecture,
boundary, delivery and test-quality reviews are self-review. Boundary verdict:
**safe with noted host-renderer risk**. Extends the planning contract in
[ADR 0075](0075-plan-retained-layout-svg-fidelity.md).

## Decision and boundaries

The pure writer consumes only current, validated retained snapshots through the
existing planner. Effective routes use native resolveEdgeGeometry precedence:
authored bends/pathStyle override retained paths and label anchors. Built-in SVG
paths use effective retained points; label envelopes position plain text at the
box centre. Text uses explicit SVG middle baseline and the existing 1.25em line
spacing, centring multiline blocks on that anchor. This is nominal text placement,
not HTML badge, wrapping, glyph-ink or font-metric equivalence. Existing unverified
findings remain visible. Without an envelope, canonical above-path label placement
is retained. Scale, cropping, budget, theme, resource and escaping rules remain.

Edge vector adapters receive frozen effective layoutRoute (if used), labelBox
(if used), and resolved geometry alongside the existing edge/endpoints/theme/font.
The route exposes world-space points, not raw executable SVG. The safe primitive
vocabulary gains an optional alphabetic/middle text baseline; unsupported values
still block atomically. Adapter rendering remains synchronous and detached from
editor state. Adapter bounds and fidelity declarations remain host responsibilities.
No custom equivalence is inferred from measured geometry.

Package review context accepts optional layout. Exact options, snapshots, keys,
findings and emitted bytes participate in existing consent/download identity.
Changed route data, render keys, source, settings or loss choices invalidate old
requests and acceptance. No parallel review state or download machinery is added.

The workbench SVG section adds an unchecked-by-default retained-layout switch.
It captures current main-editor routes only when enabled and idle, and declares a
renderer key for the current static export configuration. No retained routes is
shown explicitly. Active edits/layout retain visible protection. The working
model, source export and Undo history are unchanged by this presentation setting.
History/descriptor review restrictions still apply. PNG explicitly retains the
canonical context until a separately qualified adoption slice.

## Options and consequences

A second SVG writer would duplicate validation, resource policy and consent.
DOM cloning would couple core to browser HTML and host CSS. Reusing the validated
plan and native geometry resolver keeps those boundaries explicit. It adds public
adapter context and baseline vocabulary, both unreleased. The host still owns
source/key freshness and renderer declarations; capture cannot attest that a host
recomputed old geometry. SVG text may differ from HTML. No collapsed UI/custom
heading reproduction or large-model performance promise is added.

Only core export/review, Foldkit-hosted workbench settings and evidence change.
No dependencies, graph wire format, CLI, provider, publication or deployment
changes. Browser downloads remain Commands; core stays peer-free and pure.
Rollback is a local commit revert before release.

## Implementation and verification

- Update `src/svg-writer.ts`, reusing native `resolveEdgeGeometry` and planner checks.
- Extend `src/svg-review.ts` context without changing review request vocabulary.
- Add Model/message/update/view fields in `apps/zloz-demo/src/editor/` for opt-in.
- Test independent route/anchor coordinates, native precedence, stale blocking,
  adapter context freezing, malformed primitives, budgets and unchanged defaults.
- Test review identity/consent invalidation and unchanged workbench graph/Undo/PNG.
- Qualify installed runtime/type consumers, standalone emitted SVG parsing and
  light/dark browser captures, actual download bytes, keyboard control and errors.
- Run required check, typecheck, full tests and the production workbench build.

Next: adopt retained geometry in PNG only after this SVG boundary is qualified.
