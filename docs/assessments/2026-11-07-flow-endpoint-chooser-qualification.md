# Endpoint chooser qualification

- **result:** complete
- **claim:** reconnection choices and native controls ship at package level, with
  custom inspector and toolbar usage in the Astro workbench.
- **evidence:** focused core/composition tests, packed consumer compilation,
  TypeDoc, workspace gates and the local browser probe listed below.
- **remaining uncertainty:** native popup arrow navigation, screen-reader and
  physical-device acceptance are not established by this slice.
- **next:** extend policy-aware candidate discovery to keyboard creation of new
  connections, reusing the same validation boundary.

## Changes and ownership

`resolveEdgeReconnection` derives typed choices from the current Model. Shared
validation checks direction, changed-port permission, duplicate edges and global
connection policy. The core revalidates each `EdgeReconnected` proposal; preflight
does not grant permission for a future state. Edge metadata, selection and atomic
history remain owned by the existing reducer.

The FoldKit entry exports native field/select/reason primitives. Controls use
stable endpoint values and scoped IDs; reasons remain visible independently of
diagnostic settings. The expanded toolbar uses a scrollable band clear of reconnection handles.
The existing pointer probe caught handle occlusion before this placement fix.
No-alternative feedback leaves the current choice focusable,
avoiding focus loss after the last eligible replacement is chosen. Explicit
read-only, gesture and endpoint locks disable editing.

The workbench's local enumeration/policy checks were removed. Its custom cards
compose the package select and reasons, and both standard and compact edge
toolbars consume the package context. The default toolbar remains unchanged
unless `edgeReconnection` is enabled. No dependency, serialized schema, external
write, PR or publication was added.

## Local evidence

- `bun typecheck`, `bun run check` and `bun run test`: all exited 0.
  The affected package typecheck also passed after the toolbar-placement fix.
- `bun test packages/foldkit-flow/test/edge-endpoint.test.ts`: eight focused tests
  cover preflight/commit agreement, history/metadata, stale policies and candidates,
  visibility, missing endpoints, identity collisions, native semantics and opt-in
  toolbar composition and handle-safe toolbar placement. The full Flow suite contains 215 tests.
- The existing packed-consumer test now imports and renders the new core and
  FoldKit exports from npm tarballs in an external strict TypeScript consumer.
- `bun run --filter @opsydyn/foldkit-flow docs`: TypeDoc builds with warnings
  treated as errors. README, changelog and ADR 0004 describe the public contract.
- `bun run --filter @opsydyn/flow-sample build`: production sample build.
- From `apps/web`, run `bun - < ../flow-sample/evidence/edge-endpoint-keyboard-browser.mjs`.
  Native type-ahead changes source/target endpoints, retains focus, supports Tab
  exit and the connection-list toolbar handoff, and exercises Undo/Redo, port/end
  protection, minimal mode, a custom compact toolbar and the last-alternative focus case. Page errors must
  remain empty. Fixture setup uses programmatic policy controls; reconnection
  choices themselves use real keyboard events.
- Existing reconnection/port permission probes use the scoped package inspector
  after this slice adds a second set of controls to the canvas toolbar.

The local macOS Chromium headless shell did not change even a plain native select
using popup arrow keys. An isolated Chrome session reproduced that behavior.
Native type-ahead did change both plain controls and the production chooser, so
the durable probe uses it. This is evidence for that keyboard path, not proof of
every native menu/OS interaction. Undo/Redo retains the editor's pre-existing
selection-clearing behavior; the probe reselects the restored edge before using
its toolbar.

## Visual evidence

- [Custom inspector with protection feedback](../../apps/flow-sample/evidence/edge-endpoint-inspector.png)
- [Default canvas toolbar](../../apps/flow-sample/evidence/edge-endpoint-keyboard.png)

## Self-review

Boundary verdict: **safe with noted risk**. The pure core has no new browser or
FoldKit dependency. Candidate policies run once per proposal and must be pure;
large candidate sets may need a later search/filter UI. Default visible scope is
intentional and documented, with explicit all-authored-port opt-in. Tests exercise
both enabled and rejected commits, including a policy changing after preflight;
custom renderers still own their widget semantics and must keep protection text
associated with their controls. The expanded toolbar placement was checked
against screen-space handle positions so new controls do not consume their drag
hit targets; the regression probe explicitly checks the hit target before dragging.

Recommendation: **needs follow-up** for the next creation-chooser slice; no
publication or PR is requested.
