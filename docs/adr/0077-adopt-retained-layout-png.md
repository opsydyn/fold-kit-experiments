# ADR 0077: Adopt retained layout in PNG review and encoding

## Status

Accepted for the approved opt-in PNG slice, 2026-11-13. Architecture, boundary,
delivery and test-quality reviews are self-review. Boundary verdict: **safe with
noted renderer and browser fidelity limits**. Extends
[ADR 0076](0076-write-retained-layout-svg.md).

## Decision

Retained PNG uses existing `ZlozPngReviewContext.layout`, SVG writing, PNG planning
and optional browser encoding. No new rasterizer, graph data or request vocabulary
is needed. A render payload binds layout to the writer's validated, detached and
frozen plan snapshot, with a detached layout wrapper and PNG limits. Caller changes
to its layout after requesting a job cannot rewrite that job's geometry. Existing
expectedSvg verification still blocks a different rebuilt artifact before image or
canvas allocation. Snapshots/keys are freshness inputs, not attestations.

Consent, pending jobs, completion and downloads remain tied to the existing exact
review identity. Route/box/key/source/theme/scale/budget changes invalidate old
acceptance and artifacts. Late completions, cancelled work and live protection
cannot publish a stale artifact. Render cancellation clears model authority;
existing abort/deadline/resource cleanup remains in the optional browser entry.

The existing PNG plan evaluates the retained SVG size before allocation. Default
8192 dimension, 8,388,608 pixel and byte limits remain, with current hard maxima.
Retained routes and centre label envelopes can enlarge whole-model bounds; they
never bypass dimensions/pixels/byte checks. Explicit crops retain their chosen
extent. PNG flattens vectors and semantic text; SVG renderer/font findings and
explicit rasterization loss consent remain required.

The workbench adds a separate unchecked **Use retained layout in PNG** setting.
SVG and PNG settings are independent. Capture only idle main-editor layout and
show an Arrange protection reason when no routes are available. Enabling/disabling
or changing source/settings affects only review authority, never graph/Undo/source
exports. Existing protection and historical/descriptor review restrictions remain.
Minimal mode retains this functional control and visible findings.

## Alternatives and consequences

Sharing one global export toggle would couple independent SVG/PNG designer choices
and invalidate unrelated artifacts. Rebuilding from the current mutable context at
Command execution would weaken the meaning of a captured render job. A new PNG
layout implementation would duplicate the SVG/native precedence and fidelity
rules. Reusing the qualified SVG boundary plus immutable payload layout keeps
ownership explicit with a bounded implementation cost.

Core remains peer-free and pure; browser IO stays in Commands and `/browser`.
No dependencies, wire formats, provider/Alchemy activation, CLI changes, publication
or deployment are added. Node/SSR import behavior remains unchanged. Custom vector
bounds, theme/fonts, measured-label freshness and arbitrary HTML equivalence remain
host responsibilities. Cross-browser and large-model performance are unqualified.
Rollback is a local commit revert before release.

## Implementation and verification

- `src/png-export.ts`: detach the accepted layout from mutable caller configuration
  when producing a render payload; retain existing identity and budget checks.
- `apps/zloz-demo/src/editor/`: separate Model/message/view setting and shared
  format-aware static export context, following the SVG slice's native controls.
- Test route/label snapshot mutation after capture, expected SVG equality, stale
  results/downloads, cancellation, live policy and retained pixel-budget overflow.
- Test separate SVG/PNG opt-ins and unchanged graph/Undo.
- Exercise real browser encoding for retained routes and vector label badges,
  actual preview/download byte equality, dimensions, labelled pixel placement,
  transparency/scale, stale result suppression and no allocation on budget failure.
- Capture light/dark workbench and emitted PNG evidence, inspect it, and run root
  check/typecheck/full tests plus the production workbench build.
