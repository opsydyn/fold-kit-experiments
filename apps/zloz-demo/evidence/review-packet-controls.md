# Portable review-packet controls — local qualification, 2026-11-11

- **result:** complete
- **claim:** package-owned, composable packet preview/consent controls are demonstrated in History; the host downloads only a freshly resolved packet without editing the working graph or Undo.
- **evidence:** pure resolver tests, native SSR/composition tests, workbench regression tests, installed npm consumer checks under Node/Bun, Chromium downloads and light/dark captures; commands/results below.
- **remaining uncertainty:** local evidence only; no publication, deployment, comprehensive accessibility audit, packet import or large-model performance claim.
- **next:** needs review; then bound the DDD relationship/context-map contract before implementing its renderers.

## Scope and architecture

[ADR 0037](../../../docs/adr/0037-compose-review-packet-export-controls.md)
adds pure context/request resolvers to the optional Mermaid adapter and native
controls to its `/foldkit` entry. Root consumers still install no Foldkit/Effect.
The workbench supplies its audit IDs, data-only convention catalogue and current
host protection. Preview always computes from the working model before the view
substitutes its read-only history editor. Visible rewind is independent of export
selection. Full snapshots include authored data and cameras; the panel explains
that unrelated editions, origin and Undo are excluded.

Exact packet JSON binds consent and requests to the selected content, including
conventions, model/source names, camera and projection direction. A fresh request
rebuilds that content and checks protection; the host separately checks model ID,
epoch and the active History section. Errors reject atomically. Only the Command
performs download I/O. Consent pauses active playback. No graph edit, restore or
new Undo step occurs. The exact key is ephemeral authored data, not an auth token.

Native defaults expose scope, side-scoped diagnostics, loss consent, disabled
reasons and download. Every part can be replaced or omitted; attributes, labels,
layout and numeric visibility are independent. The app demonstrates custom scope
and diagnostic cards with a bounded disclosure list. Minimal/global diagnostics
hide numeric status while preserving functional disclosure and controls.
Audit controls and packets now use the same workbench custom conventions.

## Verification

- `bun run check`: lint, formatting, catalog and skill checks; exit 0. Existing
  repository lint warnings remain; this receipt does not claim zero warnings.
- `bun typecheck`: all workspaces; exit 0.
- `bun run test`: all workspace suites, including packed-consumer fixtures; exit 0.
- `bun run --filter @opsydyn/foldkit-zloz docs`: public TypeDoc including the new
  optional view entry; exit 0.
- `bun run --filter @opsydyn/zloz-demo build`: production static build; exit 0.
- Adapter suite: headless consent/freshness, loss-free export, missing selectors,
  projection errors, host blocks and unchanged unrelated history; SSR native
  labels, nullable/custom slots, alternate layout and count-free status.
- Packed adapter: clean npm installation, no unwanted headless dependencies,
  Bundler/NodeNext declarations, Node/Bun root execution, then explicit Foldkit
  installation and optional-view entry resolution under both runtimes.
- Workbench tests: Command creation only after consent, stale session/section,
  live import protection, target/convention changes, custom audit consistency and
  working editor/editions/Undo preservation.

The initial test-first run failed for absent exports, then the resolver suite
passed. A sandboxed packing fixture initially could not write Bun's shared cache;
qualification was rerun with the required cache access. Early browser automation
sent a target change before the preceding rewind rendered; stale epoch handling
rejected that action. The final script waits for the rendered source notice and
asserts download availability before capture. No guard was weakened.

## Browser evidence

Run after building the app:

```sh
node apps/zloz-demo/evidence/review-packet-controls-browser.mjs
```

Chromium **151.0.7922.34**, 1600×1200, reduced motion. Actual JSON downloads were
inspected for the chosen edition/current identities, full snapshots, both Mermaid
projections, conventions and audit delta. The script checks keyboard Space consent,
initial blocked download, source-change consent invalidation, independent rewind,
minimal/global diagnostic preferences and the preserved previous Undo step.
No page errors. Source: [browser script](review-packet-controls-browser.mjs).

[Light evidence](review-packet-controls-light.png) ·
[Dark evidence](review-packet-controls-dark.png).

Both screenshots were visually inspected: shared neutral/blue family themes,
custom loss cards and enabled consented download in the left pane; the full
six-node history canvas remains visible. This is local browser evidence, not
hosted or screen-reader acceptance.

Architecture, delivery and test-quality review were self-review. Dependency
ownership remains core → optional adapter; the new renderer entry imports only
Foldkit types. No independent review is claimed. Recommendation: **needs review**.
