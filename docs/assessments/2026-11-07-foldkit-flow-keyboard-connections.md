# Keyboard connections and reconnection review

Reviewed 2026-11-07 against `c1f23a1` on `feat/foldkit-flow`.
Scope: the package's keyboard connection workflow, the Astro workbench's endpoint
selectors, and the next coherent package-level bundle. This is a source and local
qualification review, not a full React Flow parity audit or release certification.

## Decision

Recommend a **composable endpoint chooser bundle**: move the workbench's source
and target selection capability into the package, derive candidate eligibility
from the same rules used to commit a reconnection, and expose reasons and native
controls for custom inspectors/toolbars. Reuse `EdgeReconnected` and existing
history rather than adding a second reconnection state machine.

Keyboard creation already ships in the package. Keyboard reconnection is
available through a host-authored inspector, but the default canvas handles are
pointer-only. Consumers currently have to recreate that inspector themselves.

## External baseline

- React Flow documents click/tap source-to-target creation through
  [`connectOnClick`](https://reactflow.dev/api-reference/react-flow#connectonclick),
  enabled by default, and strict or loose connection modes. FoldKit currently
  requires output-to-input ports; loose mode is a separate capability, not a
  prerequisite for the proposed chooser.
- Its [accessibility guide](https://reactflow.dev/learn/advanced-use/accessibility)
  documents focus, keyboard selection, node movement, focus panning and configurable
  descriptions. It does not specify connection/reconnection keyboard commands.
- Its [reconnection example](https://reactflow.dev/examples/edges/reconnect-edge)
  describes dragging an existing endpoint and applying `onReconnect`.

These inspected pages do not establish whether every React Flow configuration can
reconnect with a keyboard. The proposed chooser addresses a verified FoldKit
consumer gap; it is not evidence of superiority or complete product parity.

## Current ownership and behavior

| Capability                              | Verified implementation                                                                                 | Assessment                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Create by activating source then target | Native port buttons in `composition.ts`; delegated clicks in `input.ts`; `PortActivated` in `editor.ts` | Package capability. Native button activation supplies keyboard entry.          |
| Cancel creation                         | Escape input emits `GestureCancelled`; core cancels pending connection                                  | Existing core/input path.                                                      |
| Reconnect either endpoint               | `EdgeReconnected`, `connectionReason`, `commitGraph` in `editor.ts`                                     | Headless package capability; preserves edge identity/data and supports Undo.   |
| Enforce protection                      | `canReconnect`, changed-port `canConnectPort`, `canConnect`, duplicate and direction checks             | Core validates at commit time; read-only and active gesture guards also apply. |
| Select existing connection              | `flowConnectionButton` in `connections.ts`                                                              | Native package button, context shortcut and toolbar focus handoff.             |
| Drag selected edge endpoints            | SVG circles in `foldkit.ts`, pointer handling in `input.ts`                                             | Circles have no keyboard activation, tab index, role or accessible name.       |
| Choose source/target without dragging   | Local `endpointSelect` in `apps/flow-sample/src/editor/view.ts`                                         | Astro-host UI, not an exported package primitive.                              |
| Reconnect from stock edge toolbar       | `FlowEdgeToolbarContext` in `edge-toolbar.ts`                                                           | Rename, delete and path controls exist; no endpoint chooser context/control.   |

Paths above are under `packages/foldkit-flow/src/` unless explicitly qualified.
The historical [2026-11-05 parity review](2026-11-05-foldkit-flow-react-flow-parity.md)
describes an earlier checkout and must not be treated as the current backlog.

## Related gaps worth handling together

1. **Package ownership.** Export a model-derived reconnection context and an
   unstyled native endpoint select, with composable labels, attributes, option
   rendering and protection explanations. The workbench should consume them.
2. **Consistent candidate feedback.** The host currently lists every port of the
   matching direction and disables duplicate connections and protected ports.
   It does not precompute `canConnect` rejection reasons; those only appear after
   committing. Factor shared eligibility logic so the chooser and commit agree,
   excluding the replaced edge from duplicate/global-policy evaluation.
3. **Stable selection and understandable reasons.** The host uses array indexes
   as option values and `title` for per-port protection. Use stable endpoint
   identities, expose reasons as data for custom rendering, and provide visible
   explanatory text rather than relying on option tooltips. Keep the current
   endpoint recognizable when protected or when there are no alternatives.
4. **Discoverability and focus.** Offer opt-in integration in the selected-edge
   toolbar and support custom inspectors using the same context. Preserve the
   focused control after an accepted change or rejection; maintain ordinary Tab
   exit and the existing connection-list toolbar handoff. Avoid extra global keys.

These form one consumer workflow and can be implemented in a single bounded
bundle with narrow commits. Adding a new canvas keyboard drag mode, fuzzy search,
loose connections, automatic graph traversal, and a general accessibility audit
would enlarge the scope and should remain separate decisions.

## Acceptance criteria for the proposed implementation

- An external package consumer can render both endpoint selectors without
  duplicating candidate enumeration, policy checks or event construction.
- Default controls use native select semantics, stable values and associated
  labels/descriptions. Custom controls receive the same typed context and events.
- Source/target locks, per-port protection, global connection rules, duplicates,
  missing endpoints and read-only state have consistent reasons and cannot mutate
  history on rejection. Recheck the current policy when committing.
- Document visibility behavior explicitly: recommend visible alternatives by
  default, retaining a labeled current endpoint if hidden/collapsed. Any broader
  candidate scope must be an explicit host choice with core validity preserved.
- Accepted changes retain edge ID, metadata, selection and focused control;
  unchanged selection is a no-op; each change is one Undo step and supports Redo.
- Empty, single-choice and protected-current states remain understandable.
  Diagnostics/minimal settings may hide optional instruction/readout UI while
  retaining control labels and protection descriptions required to operate it.
- The workbench replaces its local endpoint selector with the package API and
  demonstrates custom rendering plus source/target protection. Add focused core,
  composition and Chromium keyboard regression evidence for this workflow.
- Update the package README and type contract documentation; run the required
  repo gates and commit. Publication and a PR remain outside this slice.

## Evidence and limits

Source review covered `editor.ts`, `input.ts`, `composition.ts`, `foldkit.ts`,
`connections.ts`, `edge-toolbar.ts`, the workbench endpoint selector, and existing
core reconnection tests. Those tests cover metadata preservation, incompatible
ports, policy refusal, unchanged graph/history on refusal and Undo.

The existing
`reconnect-permission-browser.mjs` probe mixes pointer dragging, programmatic native
select changes and Enter activation; it cannot prove an end-to-end keyboard-only
reconnection workflow. No new feature, screen-reader session, physical-device
qualification, CI, hosted deployment or npm publication is claimed by this review.

Local checks for this review:

- `bun typecheck`: exit 0 on the reviewed baseline; only this report changed afterward.
- `bun run check`: exit 0 after formatting this report.
- `bun run test`: exit 0; Flow specifically reported 207 passed, 0 failed.
- `bun run --filter @opsydyn/flow-sample build`: exit 0.
- From `apps/web`, `bun - < ../flow-sample/evidence/reconnect-permission-browser.mjs`:
  exit 0; source/target locks, inspector/handle agreement, reconnection, Undo and
  Enter-based creation passed with no captured page errors.

Recommendation: **needs follow-up**. Approve the endpoint chooser bundle above
before implementation. This review changes documentation only.
