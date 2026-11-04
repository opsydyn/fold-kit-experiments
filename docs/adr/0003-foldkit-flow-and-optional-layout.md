# ADR 0003: FoldKit Flow and optional ELK layout

## Status

Accepted for local implementation on 2026-11-03 following user approval of the
native FoldKit editor and replaceable layout direction. Registry publication
remains a separate release action.

## Context

Stateflow supplies machine-specific graph inspection and fixed-size layered
layout. A reusable editor needs general nodes, named ports, variable dimensions,
document edits, keyboard interaction, history and browser lifecycle management.
The application must remain the sole owner of its graph and editor state.

## Decision

Create two versioned npm packages:

- `@opsydyn/foldkit-flow`: a dependency-free graph/editor core at the root and
  an optional `/foldkit` view and scoped input adapter using the host builder.
- `@opsydyn/foldkit-flow-elk`: a separately installed ELK layout adapter. It
  consumes detached graph snapshots and returns positions/routes, never writes
  application state, and supports a caller-supplied worker-backed ELK instance.

The graph owns node/port/edge identity, positions and JSON-compatible user data.
Editor session state owns selection, viewport, gestures and bounded undo history.
Applications own persistence, execution, permissions and connection policy.
Measurements are typed facts. DOM resources are scoped to Mount; no DOM refs or
layout-engine instances enter the Model. Layout results require the active request
ID and unchanged monotonic document revision. One drag or accepted layout is one
undo transaction. Undo does not rewind the revision used for async freshness.

Use HTML node contents and SVG connections. Manual placement works without ELK.
The initial public contract is flat graphs, named input/output ports, single
pointer drag/pan, wheel zoom, keyboard selection/movement/connections/deletion,
bounded undo/redo, serialization and explicit arrange. Nested groups,
collaboration, workflow execution and a new general layout solver are deferred.

## Alternatives and consequences

React Flow would add another UI runtime. xyflow/system is explicitly maintained
for React/Svelte Flow and owns mutable interaction state. Dagre is a viable later
layout adapter; ELK is selected for explicit ports and orthogonal routes. A new
solver would add algorithm and maintenance work before proving editor value.
The optional boundary isolates ELK's size and upstream licence from the core's
dependency graph. ELK is distributed as an unmodified dependency with upstream
licensing documented; no algorithm source is copied.

Two packages cost an extra release surface but let consumers choose automatic
layout independently. The adapter pins its core peer to the same version;
versions and the peer pin are linked by the existing release tooling. Core-only Node imports must
work without browser globals, FoldKit, Effect or ELK installed.

## Verification and release

Behaviour tests precede implementation. Verify invalid graph/edit rejection,
history/cancellation, pointer identity, stale layout results, real ELK output,
keyboard/browser lifecycle, and a packed npm consumer. Packages ship ESM and
declarations with explicit export maps, licences, READMEs and changelogs.
Run publint, Are The Types Wrong, lint/format, workspace typecheck/tests and a
browser editing journey. Publish the exact checked tarballs with npm provenance
through the existing manual workflow, core first. No credential or hosted setting
changes are needed to prepare the packages locally.

The editor owns authored node widths and edge metadata as document edits.
Browser measurements update content height independently of authored width so
a resize remains undoable. Edge appearance is a view callback over graph data,
which keeps the serialized document independent of SVG rendering.

Endpoint replacement is one editor transaction. It preserves edge identity
and metadata, rechecks port direction and the host policy, and invalidates
layout routes. The policy sees the graph without the prior edge so it can
evaluate the replacement without counting that edge twice. Modeling this as
delete plus create would split history and could lose edge metadata.

Flow exposes scoped CSS variables for its built-in parts. A host may apply
generated classes, including Pleat classes, to the editor root. This gives the
host control of style registration and theme scope while Flow owns geometry.
A direct Pleat dependency would tie Flow consumers to its release lifecycle.
The public npm registry did not serve the Pleat packages when this was checked.

Groups are portless nodes with explicit parent IDs. Positions remain in canvas
coordinates, so existing edge geometry and flat saved documents keep their
meaning. Parent-relative coordinates would make containment natural but require
converting positions throughout rendering and layout. The editor expands group
movement and deletion to descendants in a single transaction. Group bounds are
authored independently of membership. Compound ELK layout follows the parent
IDs, returns coordinates relative to the canvas root, and joins edge sections
into continuous routes. Layout may update group sizes together with positions
in one undo transaction. Ordinary node sizes stay host-owned.

Grouping wraps siblings under a new boundary without translating their canvas
positions. Restricting the action to siblings preserves existing ownership when
a selection spans separate groups. Ungrouping promotes children to the nearest
remaining ancestor and preserves their connections. Each action is one history
transaction.
