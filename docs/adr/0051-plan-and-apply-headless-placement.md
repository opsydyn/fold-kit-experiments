# ADR 0051: Plan and apply headless placement

## Status

Accepted for the approved headless E2 slice, 2026-11-12. Boundary review:
**safe with noted risk**. Architecture, delivery and test reviews are self-review.
No dependency, browser adapter, publication or Alchemy integration is introduced.
Continues the reusable insertion contract and core completion audit.

## Decision

Keep placement sessions separate from `EditorState`. Core exposes `createPlacement`,
`updatePlacement`, `resolvePlacement` and `applyPlacement`, with typed data-only
source/target, snapshot, request, candidate, policy, preview and result contracts.
Palette and external sources both supply a validated self-contained graph fragment
and a grip in its world-coordinate system. External means normalized graph data,
not executable content, HTML/MIME parsing, file IO or a permission grant. Source
kind/ID are metadata; live host policies remain authoritative.

The host supplies a fresh per-incarnation scope for the editor/controller. Facts
carry scope and generation. Start captures/detaches/freezes source data, pins the
editor revision and increments generation; cancel/restart/commit invalidates old
callbacks. Target changes increment a separate target revision. A ready preview
returns a request pinning both source generation and reviewed target sample.
Apply cannot substitute a newer target for an old Apply callback. The host publishes
returned editor and placement together in one Model update. Replacing a controller
or editor requires a fresh scope; ordinary edits must retain monotonic revisions.

Targets explicitly choose world, canvas-local screen CSS pixels, or client CSS
pixels. Client targets subtract the live context's measured canvas origin first;
screen/client targets require a measured editor surface and use the existing
`screenToWorld`. Target snapshots pin relevant viewport, surface, origin and snap
settings. A pan, resize or scroll-origin change requires a fresh screen/client
target. World placements remain independent of panning and surface measurement;
zoom/presentation changes also invalidate a world target when magnetic anchors
are enabled. Browser adapters must provide current measurements and normalize any
additional CSS transforms; core does not inspect DOM or claim universal transform
support. Pointer targets outside the canvas reject; explicit world targets may be
offscreen for keyboard/programmatic use.

Grid snapping inherits editor preferences, with an explicit per-intent override.
Opt-in magnetic snapping targets visible node-frame centres/corners within a
CSS-pixel radius, before grid fallback. Exact ties use node ID and anchor kind in
code-unit order, independently of graph ordering/locale. Bypass disables both
rules. The resolved world grip determines one translation for every node, group,
port reference and authored edge waypoint. No child is independently clamped.
Empty anchor lists disable magnetic attraction. Frame snapping is not a collision
solver, port attraction or general alignment/layout engine.

Parent membership is explicit. The target parent must be a visible expanded group;
only source roots attach to it, while internal parent relationships are remapped.
Coordinates stay in world space. By default the complete inserted node fragment
must fit and roots receive `extent: 'parent'`. Explicit unconstrained membership
permits outside bounds without that extent. Placement never resizes an existing
parent or rewrites source meaning to make a fragment fit.

Extract private proposal preparation from `insertPattern`, preserving its public
API, ID allocation, validation, granular connection/port checks and selection
policy. Both insertion paths use this kernel. Placement adds live `canPlace` plus
existing whole-pattern and connection/port policies against the complete remapped
proposal; empty veto reasons still produce usable feedback. Read-only, active
interactions and disabled Undo block consistently. Expected rejection retains the
original editor/session identities, including graph, selection, routes and redo.
Malformed input throws before publication.

Preview exposes detached candidate data, not an editor publication or permission
token. Apply rebuilds from the captured intent and live context/policy, checks
scope/source/target/view freshness, and commits once through `commitGraph`.
Successful Apply ends the session; replay cannot place a second copy. Preview and
cancel create no Undo entry. Existing graph/snapshot/model v1 formats are unchanged;
source metadata is returned for host feedback/auditing, not injected into graph data.
Sessions themselves are ephemeral and have no portable wire format.

## Alternatives and consequences

Putting pending placement inside the editor would couple host palette ownership
and external transfer lifecycle to the generic gesture reducer. An independent
immutable child state supports pointer, touch, keyboard and agent callers without
UI dependencies. App-only drop handlers would fail the package ownership goal.

Calling `insertPattern` only after a cursor calculation would provide no reusable
freshness/preview contract. Duplicating its transaction would risk divergent ID,
policy and Undo semantics. A private preparation step reuses those rules without
constructing or exposing a preview editor/history transaction.

Automatic reparenting or group expansion would introduce hidden model changes and
extra movement/resize permissions. Explicit parent intent and whole-fragment
rejection keep those choices visible. Public preview copies cost memory/time on
large graphs; benchmark qualification remains separate, with no speed claim.

## Implementation and verification

- Add pure placement types/controller/resolver/apply in core and export them.
- Extract private insertion preparation/availability; keep `insertPattern` behaviour.
- Test all coordinate spaces, nested/scrolled origins, zoom, grid/frame anchors,
  bypass/ties, source detachment, cancel/restart/replay, owner/source/target/view
  freshness, group membership/containment, translated waypoints and every policy
  layer. Failed/preview operations must preserve history and redo identity.
- Use actual packed Node/Bun consumers and negative/positive TypeScript contracts;
  keep core free of browser/Foldkit/Effect peers. Generate the public API pages.
- Run root lint/format, typecheck and workspace tests. No browser/visual acceptance
  is claimed for this headless slice. Native/custom palette controls and workbench
  light/dark/minimal evidence are the next E2 slice. Alchemy remains deferred.

Rollback before release is a local commit revert. Once consumers depend on these
public contracts, scope/coordinate and freshness changes need an explicit
compatibility decision rather than silently changing placement semantics.
