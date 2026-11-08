# ADR 0006: Compose C4 preset renderers from public Flow primitives

## Status

Accepted for local implementation on 2026-11-08 following approval of C4 preset
renderers and a themed system-context workbench demo. Implements the rendered
follow-up to ADR 0005, using ADR 0004's existing composition boundary.

## Decision and alternatives

Ship `flowC4Node` and `flowC4Group` in the optional `/foldkit` entry. They accept
the standard shell context and host builder, return undefined for other families,
and compose the same frames, handles, ports and controls as consumer shells.
The root remains dependency-free. Sample-only C4 drawing would fail package
reuse; changing every generic node's default appearance would remove explicit
consumer choice. Both alternatives are rejected.

Options expose replaceable/omittable icon, type, name, technology, description
and body content, frame attributes and live controls. Artwork inside a drag
button is inert; interactive editors belong in the live controls slot. Native
accessible selection names remain available when visual name content is omitted.
Optional body caching uses node, selection, builder and stable options as inputs;
it never captures full EditorState or port authorization. Controls stay live.

Draw the authored outline using the pure core geometry. Extend its result with
decorative paths for the cylinder's inner cap, rather than duplicate shape math
in the view. The Person adornment fits inside its authored outline. Renderer
height uses the Model's authored height, so scoped measurements acknowledge the
same bounds rather than measuring a second silhouette. Text fits/clips inside
safe content bounds; callers own dimensions and can replace content.

Use existing scoped Flow theme tokens and semantic external text/dashes. No
colour is the sole type/scope carrier. C4 boundaries retain rectangular, portless
group behavior. Resize/context/collapse controls and policy-controlled ports
remain outside artwork. Selection/previews affect outline decoration through
the current context. Semantic text is not a measurement diagnostic; minimal mode
preserves it, and slots can omit optional presentation independently.

Astro demonstrates a proper system-context view and a separate container detail
view; it does not mix abstraction levels or own reusable rendering behavior.
These are authored fixtures, not newly claimed atomic pattern builders. Component
rendering is qualified through the package tests and packed consumer.

## Implementation and verification

- Add `c4-renderer.ts` and optional-entry exports, using `nodeShapeGeometry`,
  public composition primitives and the existing native port resolver.
- Extend pure outline geometry with decorative paths; preserve anchor semantics.
- Add sample fixtures and a C4 design choice using package exports and existing
  light/dark preference handling. Keep theme changes out of graph/history.
- Test role/fallback/outline agreement, semantic slots, theme variables, policy
  reasons, body-cache boundaries and native semantics with real FoldKit SSR.
- Extend strict external tarball consumption; build TypeDoc and the production
  sample. Run browser interaction checks and inspect light/dark screenshots.
- Run workspace typecheck/check/test serially where generated output overlaps.

No new runtime, dependency, persistence schema or alternate input store is added.
No Mermaid/agent/edition APIs are implemented in this slice; those are product
assessment work. Revisit this decision if shaped groups or automatic content
height are introduced. Reverting the optional renderer choice restores generic
shells without changing document data.

## Local qualification, 2026-11-08

- [x] All four roles, non-C4 fallback, slots, frame paint, safe bounds, native
      semantics, live policies and body-cache inputs pass real FoldKit SSR tests.
- [x] Strict Bundler/NodeNext packed consumer compiles/runs the public presets.
- [x] The production browser checks native focus, move/resize/connect/drag/Undo,
      theme changes, curved anchors, collapse/expand and group resize/Undo.
- [x] All four light/dark screenshots were inspected; group controls no longer
      overlap the title and authored spacing keeps labels legible.
- [x] Workspace typecheck/check/test and warning-strict TypeDoc generation pass.

See [evidence](../../apps/flow-sample/evidence/c4-renderers.md). This completes
renderer/demo qualification; it does not complete the broader pattern-builder
roadmap or introduce Mermaid, agent or edition packages.
