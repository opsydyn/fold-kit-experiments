# Read-only portable review reader — local qualification, 2026-11-13

- **result:** complete
- **claim:** package-owned guarded review state and composable controls open portable packets in a detached workbench canvas, preserving the working model/Undo and last accepted review on failure.
- **evidence:** strict literal fixture/controller tests, native/custom/minimal SSR tests, actual File Command regression tests, installed Node/Bun consumer checks, production Chromium workflow and inspected light/dark/minimal captures; commands/results below.
- **remaining uncertainty:** local evidence only; synchronous bounded decoding has no wall-clock responsiveness guarantee. No hosted/device/manual AT qualification, authenticity guarantee, writable import, publication, deployment, PNG or Alchemy.
- **next:** needs review; then define the P2 headless modelling-patch vocabulary, provenance and dry-run contract before Apply.

## Contract and ownership

[ADR 0059](../../../docs/adr/0059-open-review-packets-with-detached-reader-controls.md)
records the public reader API in the optional Mermaid adapter, with native controls
in `/foldkit`. The headless entry introduces no Foldkit/Effect/browser dependency.
The host performs File IO only in a Command: 1 MiB byte limit before and after
reading and fatal UTF-8 decoding, followed by the existing strict decoder. Scope,
monotonic read run, current protection and matching review/side guard publication
and canvas facts. Logical cancellation discards publication, without claiming to
abort a browser File read. Invalid/stale/cancelled/protected reads retain the
previous packet, comparison side and preview camera. Closing invalidates pending
publication. Unique host model-incarnation scopes prevent cross-model callbacks.

A separate read-only editor renders canonical snapshots with semantic shells;
Mermaid strings are retained data and are never executed/injected. Core's
read-only history adapter admits navigation and rejects edit events. The actual
working graph, camera, Undo, editions, saved models, mapping receipts and consent
remain unchanged by reference. Reader and detached preview publish together.
Active graph/layout/import/receipt/history work and hidden opening contexts block
opening, with live completion checks. Baseline/selected changes require an idle
preview; close remains available. Theme, minimal/diagnostic settings and detached
Fit/pan remain available. Failed reads require no model restoration or Undo.

Native controls show audit findings, projection losses, pending/cancel state and
visible protection reasons. Summary/finding/layout slots support custom consumers;
null omits, undefined uses defaults. Counts and instructions can be hidden without
removing functional findings or actions. The workbench uses the shared neutral/blue
family theme, a visible selected-side treatment and the existing left sidebar.

## Verification

- Baseline root `bun typecheck` and `bun run check`: exit 0.
- Final root `bun typecheck`, `bun run check`, `bun run test`: exit 0. Existing
  repository lint/skill warnings remain; this receipt does not claim zero warnings.
- `bun run --filter @opsydyn/foldkit-zloz docs`: TypeDoc, exit 0.
- `bun run --filter @opsydyn/zloz-demo build`: production build, exit 0.
- Controller tests: strict success, retained last-good packet/side, live opening and
  selection protection (including empty reasons), cancellation, supersession,
  foreign scope, stale IDs and close invalidation; oversize metadata emits no IO.
- View tests: native input/side disabled states and reasons, selected state,
  findings, nullable/custom slots, alternate layouts and count-free minimal mode.
- Workbench tests: actual File Command success/fatal UTF-8 failure, oversize/no IO,
  chosen-side retention, changed model epoch, live protection, cancel/late reply,
  detached camera, rejected edge deletion, stale canvas and close; original editor,
  Undo, editions, identity, saved models, receipts and consent retained.
- Packed consumer: actual tarball, clean offline npm install, headless dependency
  absence, root reader execution under Node/Bun, Bundler/NodeNext type resolution,
  then explicit Foldkit installation and optional reader entry under both runtimes.

The initial focused red run failed for missing exports. Focused tests then passed.
The first full typecheck found two test typing errors, fixed before the final pass.
An early formatting check identified the new browser script; formatting was fixed.
The first browser run used a nonexistent fixture node ID; the selector was corrected
to the literal fixture ID before capture. No policy or validation guard was weakened.
Shared-dist builds, workspace tests and documentation builds ran sequentially.

## Browser evidence

After building, run:

```sh
node apps/zloz-demo/evidence/review-reader-browser.mjs
```

Chromium **151.0.7922.34**, 1600×1100, reduced motion. Real native file opening
renders selected/baseline snapshots and audit/loss findings. Malformed JSON,
forged derived Mermaid and invalid UTF-8 preserve the previous baseline review.
Opening protection disables file selection with a reason. Minimal mode hides
numeric summaries/instructions while findings and close remain available. The
working graph returns after close. No page errors.

[Light selected snapshot](review-reader-light.png) ·
[Dark protected baseline](review-reader-dark-protected.png) ·
[Minimal recovery state](review-reader-minimal.png) ·
[Reproducible script](review-reader-browser.mjs).

Captures were visually inspected for the full canvas beside the scrollable left
sidebar, semantic node/edge rendering, selected-side feedback and visible recovery
or protection status. This is local synthetic browser evidence, not manual AT or
hosted acceptance. Architecture/boundary, delivery and test-quality review are
self-review; no independent review is claimed. Recommendation: **needs review**.
