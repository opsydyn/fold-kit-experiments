# ADR 0063: Rasterize reviewed model artwork as PNG

## Status and scope

Accepted for the approved package PNG/workbench slice, 2026-11-13. Architecture,
boundary, delivery and test-quality reviews are self-review: needs review.
No new dependency, npm publication, deployment or Alchemy implementation.

## Decision

Core owns a pure `planPngExport` over the existing safe SVG writer result, bounded
integer pixel dimensions and encoded-byte budgets. Reuse SVG regions, themes,
transparent background, typed custom adapters and validated font resources. Carry
all SVG findings forward. Rasterization is a separate explicit loss of editable
vector/text/model semantics; require loss acceptance. PNG is canonical static model
artwork, not a screenshot of arbitrary HTML/custom UI, controls or overlays.

Defaults/caps: maximum dimension 8192/16384, pixels 8,388,608/16,777,216 and encoded
PNG bytes 8,388,608/33,554,432. Hosts may tighten or choose within hard caps. Round
positive SVG output dimensions upward; reject nonfinite/unsafe/oversized products
before canvas allocation. Respect SVG output scale; never implicitly multiply by
window.devicePixelRatio. Invalid configuration is a core ZlozError; unavailable
artwork or budget excess is a blocked plan with explicit findings.

An optional `/browser` entry safely imports under Node/SSR but reports unsupported
when invoked there. It rebuilds SVG from the snapshot/options through the existing
writer; no raw HTML/arbitrary-SVG public input. A reviewed expected SVG must match
before rendering. Decode an owned SVG Blob URL, draw into a detached canvas and
request native image/png encoding. Check nonempty MIME, byte budget, PNG signature
and IHDR dimensions, then return immutable data URL/size metadata. The exact PNG
preview data URL is later downloaded, with no rerender. Data URLs avoid persistent
preview URL ownership; SVG URLs, image handlers/readers and canvas buffers are
released on success, failure, abort and timeout. Default timeout 10s, capped at 30s.
Logical cancellation prevents publication; native decoding/encoding may finish
later and is discarded. Browser pixel/font rendering is not cross-browser-identical
and Chromium qualification is not a manual/device or server-rendering claim.

Core review state composes existing SVG preferences with asynchronous PNG run
identity, loss acceptance and exact-source/artifact freshness. Source revision,
region/camera where relevant, theme, SVG output/findings, settings and pixel limits
bind requests. A new render clears the prior downloadable candidate; failure never
makes an old image downloadable for current content. Changing settings/model or
Undo invalidates acceptance/results. Late/cancelled replies cannot publish. Host
protection is rechecked at generation completion and download. The working graph,
camera and Undo are never changed. Blob/canvas IO runs only in host Commands.

Optional Foldkit controls expose native settings, findings, explicit acceptance,
render/cancel, the actual PNG preview and download; slots/action attributes and
numeric/instruction controls support custom/minimal UIs. The Astro workbench uses
a dedicated PNG sidebar, the same themes and original visible canvas.

## Alternatives and consequences

DOM screenshots would silently capture controls or lose custom renderer/resource
meaning and couple export to Astro. A native encoder in core would add a platform
dependency. Rasterizing the already qualified vector vocabulary preserves a
bounded fidelity contract and browser-free core. Costs are synchronous SVG planning,
main-thread native work within explicit bounds and data-URL memory overhead. Limits
are not a peak-memory, exact font shaping or wall-clock performance guarantee.
System fonts remain reported uncertainty; embedded font rendering still needs
browser qualification. Errors never silently download an empty/fallback artifact.

## Verification

Start with pure plan/review tests for dimensions, limits, losses, stale/Undo/cancel,
protection and graph preservation. Qualify optional entry resolution in installed
Node/Bun consumers and native browser success/failure/cancellation/resource cleanup.
Inspect actual downloaded PNG signature, dimensions, alpha/background and equality
with preview bytes; capture light/dark/custom/minimal workbench. Run root checks,
typecheck, all tests, TypeDoc and production build sequentially for shared dist.
Commit PNG/evidence first, then perform the separately requested Alchemy review.
Rollback is a local revert with no model wire migration.
