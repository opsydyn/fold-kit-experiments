# ADR 0111: Rasterize reviewed native v3 SVG as PNG

## Status and scope

Accepted, 2026-11-16. The user approved native v3 PNG using ADR 0110's validated
SVG projection/fidelity contract, workbench demo, tests, visual evidence, roadmap
and a local commit in the existing isolated worktree. Architecture, boundary,
delivery and test-quality reviews are self-review. No publishing/deployment.

## Decision

Keep planning/review in peer-free core and browser IO in the existing optional
`/browser` entry. Distinct native v3 APIs rebuild SVG with
`writeGroupSvgExportV3`; no bare-graph legacy writer, downgrade or DOM screenshot
is used. PNG adds an explicit rasterization loss to unchanged SVG findings and
uses the existing integer dimension/pixel/byte budgets before allocation.

Share internal PNG review transitions and browser resource management instead of
copying them. Native deferred input owns the full v3 document, data-only SVG
options, retained layout and font bytes. Adapter functions remain host callbacks;
rebuild must match the exact reviewed SVG bytes before rasterization. A native
render payload never passes through the legacy snapshot codec.

Consent binds source session/revision/full document, palette/crop/scale, renderer
bytes, findings and budgets. Recheck source, current policy and consent at render
request, completion and download. Cancellation/supersession rejects late results;
AbortSignal/deadline cleanup is retained. Native settlement also binds data-URL
byte length and IHDR dimensions to the approved plan. Artifacts are trusted
browser-render results, not an external PNG import/decoder contract.

Show the actual encoded PNG, then download that exact data URL without rerender.
Export never changes authored state or Undo. Group sockets, strict/loose mode and
capability remain in the source/projection; raster pixels do not retain editable
semantics. Read-only editions have independent export scopes.

## Alternatives and consequences

Calling legacy renderPngExport with an extracted graph would erase capability
validation. Copying review/raster machinery would duplicate cancellation,
resource cleanup and fidelity behavior. A server/native encoder is a separate
runtime/dependency decision and is not added here. Core remains importable without
DOM, Foldkit or Effect; browser entry is SSR-safe and reports unsupported on call.

Browser image decoding/encoding, fonts, antialiasing and pixel colors may differ
across platforms. Safe SVG findings remain visible. Synchronous canvas work and
encoding cannot always be physically interrupted; logical cancellation prevents
publication. No broad performance, human device/AT or universal renderer-fidelity
claim follows from automated browser evidence.

## Implementation and verification

- `group-png-v3.ts`: native input/plan/controls/payload types and full-source review;
  reuse shared PNG lifecycle via explicit native hooks.
- `png-export.ts`: extract internal version-neutral projection/transition helpers,
  preserving public legacy behavior and tests.
- `png-browser.ts`: distinct native export calls the native SVG writer; shared
  private rasterizer retains budgets, AbortSignal, timeout and cleanup.
- Workbench: separate PNG review state, palette/crop/scale, retained routes,
  custom-shell findings, protection and Command-based render/download.
- Test true native group-port sources, exact SVG reuse, integer budgets,
  immutable deferred source/options/layout/font bytes, stale/policy/cancel/failure
  paths, encoded-artifact bounds, SSR imports, installed consumers and legacy
  refusals. Browser evidence inspects actual PNG IHDR/pixels, compares preview and
  downloaded bytes, exercises both palettes/transparency/crops and unchanged Undo.
- Required checks: lint/format, workspace typechecks/tests, production demo/API
  build, source-hashed browser evidence and Moon pre-commit checks before commit.

Rollback is a local revert. Canonical model formats/dependencies stay unchanged.

## Qualification refinements

Actual browser review exposed nested labels including select-option text. PNG and
SVG default review fields now use independent `label[for]` elements beside their
controls; exact-name regression tests and browser selectors qualify the change.
Custom slot APIs remain unchanged. The rasterizer also checks for abort again
after synchronous SVG rebuilding, before resource allocation, so a callback-time
abort cannot slip past the initial signal check.
