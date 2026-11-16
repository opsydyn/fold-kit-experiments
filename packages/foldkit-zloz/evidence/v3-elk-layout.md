# Native v3 ELK layout qualification

- result: complete
- claim: Native v3 layout preserves authored group ports and applies geometry as one undoable transaction.
- evidence: Core, real-engine, app and installed-consumer tests; required checks and browser evidence recorded below before commit.
- remaining uncertainty: No hosted deployment, publication, human AT/device acceptance, broad performance or arbitrary-content collision qualification.
- next: Native v3 SVG projection/export, followed by PNG using the same projection.

Scope and ownership: [ADR 0109](../../../docs/adr/0109-layout-native-v3-groups-with-elk.md).
Architecture, boundary, delivery and test-quality reviews are self-review.
Core owns source validation/geometry/atomic publication; optional ELK owns engine
translation; the host Model owns active request identity and worker lifetime.
No legacy editor, erased capability or implicit downgrade is used.

Tests cover full-document Undo, stale request/session/revision/document, exact
routes/anchors, invalid/partial/accessor engine output, resize/extent constraints,
current move/resize/commit policy and policy-defect propagation. Real elkjs 0.12.1
covers RIGHT/DOWN nested groups, unused ports, group-to-child edges, crossing
edges, custom anchors, empty/disconnected/loose documents and header/label hints.
Workbench tests cover request supersession/cancellation, live policy changes,
intervening edits, replacement and read-only review. Transient routes are hidden
for moving/collapsed geometry and invalidated by edits/Undo.

The initial real-engine FIXED_RATIO test failed inside ELK on nested ports.
FIXED_POS passed both directions. Authored port records remain unchanged; route
leads join final anchors after group resizing. Those leads may be oblique and
are not a universal obstacle-avoidance guarantee. Default ELK runs in-process;
logical cancellation ignores results rather than terminating engine work.
Standalone Bun ELK lifetime remains an upstream limitation; installed engine
execution is qualified under Node, while core also runs under Bun.

## Observed verification

Local verification on 2026-11-16, Bun 1.4.4 / Node 24.15.0:

- `bun run check`: exit 0, including Oxlint/Oxfmt/catalog/skill checks. The
  pre-existing Viz skill-version warning remains separate from this slice.
- `bun typecheck`: all workspaces exit 0. Focused core and ELK `tsc --noEmit`
  checks also passed after final review changes.
- `bun run test`: all workspace tests exit 0, including installed Node/Bun core,
  strict Bundler/NodeNext contracts, Node ELK execution and private CLI consumers.
  First sandboxed attempt could not write the host Bun cache; reran with required
  cache/network access. No tests were disabled. Existing conditional skips remain.
- Post-review core unit suite: **900 passed**. Adapter plus app layout tests:
  **21 passed**. The full workbench suite passed **194 tests**.
- `bun run --filter @opsydyn/zloz-demo build`: exit 0, four static routes.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0 with warnings treated as
  errors, including the new core/workbench/ELK public API links.
- Chromium **151.0.7922.34**, 1440×960, reduced motion: **4 interaction groups
  passed, zero page errors**. Captures were inspected in light/dark/minimal modes.
  The connected group port and both edge identities survive each direction;
  one Undo restores every bound. Protection vetoes all geometry and remains
  visible in minimal mode; read-only review disables layout.
- The browser receipt records SHA-256 hashes for **160** source files. Those
  hashes were independently checked against the final working source.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-elk/browser.json) ·
[Light RIGHT](../../../apps/zloz-demo/evidence/v3-elk/light-right.png) ·
[Dark DOWN](../../../apps/zloz-demo/evidence/v3-elk/dark-down.png) ·
[Minimal protected](../../../apps/zloz-demo/evidence/v3-elk/minimal-protected.png).
The repeatable browser script sits alongside these captures.

No remote CI, hosted deployment, fresh empty-cache CI rehearsal or npm publication
was run for this local commit. Installed-consumer tests use local tarballs;
they are not registry publication evidence. Human acceptance remains unclaimed.

Recommendation: **needs review** before a PR/merge; native v3 SVG export is the
next bounded feature.
