# Policy-aware connection creation qualification

- **result:** complete
- **claim:** policy-aware creation choices and native primitives ship at package
  level, demonstrated by a custom workbench panel.
- **evidence:** all workspace gates, 220 Flow tests, strict packed consumer,
  TypeDoc, production sample build, four browser probes and inspected screenshot.
- **remaining uncertainty:** native popup arrow navigation, screen-reader,
  physical-device, CI and hosted/registry qualification were not performed.
- **next:** searchable/grouped candidates shared by creation and reconnection.

## Package behavior

`resolveConnectionCreation` derives source/target fields and a cancel action from
the current editor and policy. Native FoldKit select, reasons, field, cancel and
panel primitives consume that context. `connectionCreation` opts into the view
panel and `renderConnectionCreation` replaces its layout. The workbench composes
its custom panel from the public select/reasons/cancel primitives.

The implementation reuses `EditorState.connection`, `PortActivated`,
`GestureCancelled` and the existing connection validation/history path. Shared
`proposedEdge` lets preflight evaluate the same proposed ID as the reducer; choice
events carry a port endpoint, so a later commit allocates from the current graph
rather than reserving an ID during rendering. Source selection adds no history;
creation adds one Undo step and preserves existing edges and metadata.

Visible alternatives are the default, with retained hidden current sources and
explicit all-authored-port scope. Stable values encode node/port identity. Port,
direction, duplicate and global connection checks remain authoritative at commit.
No-source/no-choice hints leave the placeholder focusable after reset, while
explicit read-only, gesture and source restrictions disable affected fields.
Escape from an active chooser and the native Cancel action clear the pending
source without adding history. Required descriptions remain in minimal mode.

## Local evidence

- `bun typecheck`: exit 0 across the workspace. The affected package typecheck
  also passed after the final test refinements.
- `bun run check`: exit 0, including formatting and catalog validation.
- `bun run test`: exit 0 across the workspace; Flow reported 220 passed,
  zero failed, including the updated packed-consumer test.
- Five new core/composition tests cover staging without history, preflight/commit
  agreement, duplicate/global/port rejection, source and input policy changes after
  preflight, stale missing targets, current-graph ID allocation, Undo/Redo,
  cancellation, visibility/collapse, hidden source retention, empty/missing source
  feedback, opt-in rendering and read-only native controls.
- The packed-consumer test imports/renders every new public primitive from local
  npm tarballs and compiles under strict TypeScript outside the monorepo.
- `bun run --filter @opsydyn/foldkit-flow docs`: exit 0, with TypeDoc warnings
  treated as errors. README, changelog and ADR 0004 describe the new contract.
- `bun run --filter @opsydyn/flow-sample build`: exit 0.
- From `apps/web`, `bun - < ../flow-sample/evidence/connection-creation-browser.mjs`:
  exit 0. Real native keyboard type-ahead creates connections, resets the fields
  and retains target focus. The probe covers Tab exit, source sharing with native
  canvas ports, Escape/Cancel, policy descriptions, disabled choices, minimal mode
  and Undo/Redo, with no captured page errors.
- Existing `edge-endpoint-keyboard-browser.mjs`,
  `reconnect-permission-browser.mjs` and `port-permission-browser.mjs`: exit 0
  against the new sample build. The new panel sits outside the canvas and leaves
  reconnection drag handles usable.

The browser fixture respects existing workbench behavior: port-lock settings
cancel pending connections, minimal mode uses a Connections disclosure, and Undo
is always enabled. Graph outcomes are asserted instead of inferring history from
the button's availability. Independent core tests cover policy changes that keep
the source staged. Native popup arrow navigation, screen-reader and physical-device
acceptance were not established; the automated keyboard evidence uses type-ahead.

## Visual evidence

[Custom creation panel with protected choices](../../apps/flow-sample/evidence/connection-creation.png)

## Self-review

Boundary verdict: **safe with noted risk**. Pure creation context and shared
validation remain dependency-free; FoldKit/Effect stay in the optional adapter.
There is no new draft store, persisted schema, dependency or direct DOM mutation.
Policies must be pure because each candidate invokes them. Large diagrams may
benefit from a later searchable/grouped chooser; that is separate from this
bounded creation workflow. Custom widgets remain responsible for their semantics
and for associating the supplied protection descriptions with their controls.

Recommendation: **needs follow-up** for searchable/grouped candidates shared by
creation and reconnection. No PR, deployment or npm publication is part of this
slice.
