# V3 core batch qualification

Scope: [ADR 0108](../../../docs/adr/0108-release-the-scoped-v3-core.md).
This receipt is updated with measured checks before delivery. Architecture,
boundary, delivery and test-quality review are self-review.

## Contracts

- `group-connection-v3.test.ts`: creation/reconnection/explicit multi-edge
  rollback, strict/loose and group endpoints, source/lifecycle/policy checks,
  identity/metadata retention and one Undo.
- `group-operations-v3.test.ts`: descendant movement once, world-coordinate
  reparenting, cycle/extent/resize constraints, protected ancestor expansion,
  complete deletion, group/ungroup and explicit ported-ungroup refusal.
- `model-v3.test.ts` and literal `fixtures/model-v3.json`: bounded owned decoding,
  duplicate fields/IDs, old-reader rejection, per-frame modes/capabilities/camera,
  detached read-only review, mode/capability-only comparison, merge/fork/restore.
- `group-workbench-v3*.test.ts`: transient snapped pointer preview, cancellation,
  current veto at release, stale sources, readonly/Undo, native SSR ports and
  collapsed presentation, keyboard controls and minimal-mode protection reasons.
- `portable-compatibility-v3.test.ts`: independent checkpoint inventory and no
  partial downgraded target. CLI command tests qualify read-only inspection and
  malformed/incompatible version rejection.
- `apps/zloz-demo/test/group-workbench.test.ts`: live-camera checkpoint and
  independent review/restore; delayed model-open results cannot overwrite newer
  requests or intervening graph edits.
- Installed `test/package.test.ts`: peer-free core runtime under Node/Bun,
  Bundler/NodeNext types, native SSR and public custom primitives after explicit
  optional peer installation, without workspace links.

## Limits

V3 native surface: pointer node movement and connections, keyboard
selection/nudging/connections, inspector resizing/group-port editing/reconnection,
collapse and custom content/action controls. Direct pointer resize/reconnection,
port-anchor dragging, box selection, pinch and minimap are not qualified here.
Source-bound planners remain available to custom controls. UI previews are never
permission to Apply.

V3 clipboard/layout/SVG/PNG/Mermaid/patch/receipt/packet/relationship-audit adapters
are not shipped. Use the complete canonical v3 model; explicit downgrade review
refuses authored group ports in any checkpoint. V1/v2 entries remain fixed.
Rotation/whiteboard/import/server PNG, broad performance and human physical-device
and screen-reader acceptance remain open. This is not full React Flow parity.

## Observed checks and delivery

Local qualification observed on 2026-11-15, Node 24.15.0 / Bun 1.4.4:

- `bun run check`: exit 0. The existing Viz skill 0.17.0 asset pin warning is
  outside this workstream; no unrelated skill migration is included.
- `bun typecheck`: exit 0 across workspaces.
- `bun run test`: exit 0; core unit suite 892 passing, demo 192 passing, private
  CLI 36 unit and its installed-consumer test passing. Existing optional promo
  skip remains a skip, not acceptance evidence.
- Core installed tarball consumer: exit 0 under Node/Bun and strict
  Bundler/NodeNext types, including peer-free core and optional native SSR.
- `bun run --filter @opsydyn/foldkit-zloz docs`: exit 0, warnings treated as errors.
- `bun run --filter @opsydyn/zloz-demo build`: exit 0, four static pages. The new
  island prerenders its Preparing status; unique session identity is allocated
  in a client Command before the interactive canvas appears.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-core/browser.json) records
Chromium 151.0.7922.34, a 1440×960 viewport, reduced motion, source-file hashes
and seven passed interaction groups with no page errors. It covers pointer group
movement/descendants/Undo, keyboard movement and source/target creation, live
protection, theme/minimal presentation, group-port addition/Undo, detached
history/restore and validated model download/reopening. Visual review caught and
corrected the separate inspector's missing theme scope; the final browser run
also checks its resolved dark control paint.

- [Light](../../../apps/zloz-demo/evidence/v3-core/light.png)
- [Dark with live protection](../../../apps/zloz-demo/evidence/v3-core/dark-protected.png)
- [Minimal with protection reasons](../../../apps/zloz-demo/evidence/v3-core/minimal-protected.png)
- [Read-only edition](../../../apps/zloz-demo/evidence/v3-core/readonly-edition.png)
- [Exact downloaded canonical JSON bytes](../../../apps/zloz-demo/evidence/v3-core/model-v3.json.txt)
- [Reproduction script](../../../apps/zloz-demo/evidence/v3-core-browser.mjs)

This is local evidence. A committed-HEAD empty-cache `ci:clean` rehearsal gates
push; required remote CI gates merge. Registry versions, integrity/provenance and
a registry-installed consumer must be verified separately after publication.
This source receipt does not infer remote delivery from local checks.
