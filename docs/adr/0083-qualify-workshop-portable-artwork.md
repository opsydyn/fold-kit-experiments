# ADR 0083: Qualify workshop portable artwork

## Status

Accepted for the approved SVG/PNG qualification slice, 2026-11-14. Extends
ADRs 0081–0082. Architecture, boundary, delivery and test-quality reviews are
self-review.

## Decision

Qualify canonical built-in SVG artwork for EventStorming external systems,
hotspots and lanes in the existing safe writer. Use authored geometry, participant
ports, labelled dashed external-system/lane outlines, theme accent tokens, and
explicit Open question/Resolved hotspot text. Hotspot colour and text come from
its required authored status; status remains semantic content regardless of
workbench diagnostics. A crisp 2px workshop border survives rasterization.
The original unsupported-role planner guard is superseded only for these built-in
projections. Status text passes through the same escaping, font-coverage and
resource-budget checks as other exported text.

Keep the existing projection boundary: this is canonical model artwork, not a
capture of arbitrary native/custom DOM. Custom status badges and UI shells remain
explicit fidelity fallbacks requiring exact-artifact loss consent. Semantic edge
notation also retains its existing loss finding. Fonts, ink extents and wrapping
retain their current qualification findings. No implied host adapter equivalence.

PNG continues to rebuild and rasterize the exact reviewed SVG through the existing
browser entry, with expectedSvg freshness and dimension/byte/cancellation gates.
There is no separate workshop raster renderer or new dependency. Authored graph,
wire formats, policy authority, receipts and Undo remain unchanged. Astro composes
public review controls and visibly explains the custom badge substitution.

## Alternatives and consequences

Keeping the unsupported guard would prevent useful default portable workshop
artwork. A host-only adapter would conceal reusable core behaviour. DOM screenshots
would bypass explicit projection, resource and fidelity boundaries. Reusing the
writer gives one escaped, bounded vector source for both formats, while accepting
that static layout, system fonts and semantic edge labels are not native UI parity.

## Acceptance

Literal workshop wire tests cover role/frame/status/ports and light/dark accent
expectations, authored status changes, model immutability, escaping, resource limits
and custom fallback consent. Installed-package coverage confirms shipping entries.
Production workbench downloads demonstrate custom-loss review, matching preview/
download bytes, theme/status invalidation and Undo. Public browser checks capture
the actual rasterizer Blob, compare it to the reviewed SVG, compare every decoded
RGBA pixel to independent SVG rasterization and locate status/system accent pixels.
Old status/theme expectedSvg inputs must fail as source-changed.

Rollback before release is revert/rebuild; no authored data migration. No release,
publication, deployment, new conversion rules or EventStorming-to-C4 inference.
