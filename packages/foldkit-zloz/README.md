# Foldkit Zloz

Graph editing with state owned by your application. The pure TypeScript core has
no runtime dependencies. The optional `/foldkit` entry renders HTML nodes and SVG
edges through your existing FoldKit builder. ELK is available separately as
`@opsydyn/foldkit-zloz-elk`.

Version 0.1.0 is a local release candidate; npm publication has not been performed.

## Install

After publication:

```sh
npm install @opsydyn/foldkit-zloz
# Only for the native view:
npm install foldkit@0.170.0 effect@4.1.0 @effect/platform-browser@4.1.0
```

For this checkout, use the checked tarball described in
[the publication guide](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-zloz.md). ESM only, Node 22+
for tooling. The view is for browsers; pure imports do not access browser globals.
The tested view baseline is FoldKit 0.170.0 / Effect 4.1.0. Both are optional peers.

## Core

```ts
import { createEditor, updateEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-zloz';
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Source',
      position: { x: 40, y: 40 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
  ],
  edges: [],
};
const editor = createEditor(graph);
const selected = updateEditor(editor, { type: 'NodeSelected', id: 'source', additive: false });
const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
const document = serializeGraph(moved.graph);
const restored = createEditor(parseGraph(document));
```

Keep the editor in your Model. Nodes have stable IDs, positions, positive dimensions
and named input/output ports. Port offsets are fractions of the chosen side. Edges
refer to both node and port IDs. Optional node/edge `data` accepts finite JSON data.
Functions reject duplicate IDs, invalid sizes and missing/wrong-direction endpoints
with `ZlozError`. JSON syntax errors remain `SyntaxError`.

`updateEditor(state, event, { canConnect })` lets the application reject a proposed
connection with a reason or accept it with `null`. Cycles are allowed by the core.
Exact duplicate connections are ignored with a notice. The policy is supplied by
the host on each update; it is not serialized into the Model.

Each completed drag, keyboard nudge, graph edit or accepted layout is one undo
transaction. Escape restores the pre-drag positions. The default history limit is
100 (configurable from 0 to 1000). Measurements update dimensions without creating
history entries. Undo and measurements advance the revision used to reject stale
layout results. Selection, viewport, gestures and history are excluded from saved
documents. Applications own storage and migration beyond document version 1.

## Headless C4 and DDD nodes

The package owns architecture semantics and outline geometry independently of the
Astro example. C4 artwork is opt-in through the public presets below; the generic
FoldKit view keeps its existing defaults. DDD artwork and pattern builders remain
subsequent slices.

```ts
import {
  createArchitectureNode,
  createEditor,
  updateEditor,
  nodeShapeGeometry,
  nodeShapeContainsPoint,
  portPosition,
} from '@opsydyn/foldkit-zloz';

const store = createArchitectureNode({
  id: 'orders-store',
  label: 'Orders',
  position: { x: 40, y: 40 },
  size: { width: 200, height: 120 },
  ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
  architecture: {
    family: 'c4',
    role: 'container',
    technology: 'PostgreSQL',
    description: 'Stores accepted orders',
    scope: 'internal',
  },
  appearance: { shape: 'cylinder' },
  data: { owner: 'sales' },
});
const geometry = nodeShapeGeometry(store); // local SVG outline and content bounds
const endpoint = portPosition(store, 'out'); // canonical world coordinates
const hit = nodeShapeContainsPoint(store, endpoint); // inclusive world-space hit test
const editor = createEditor({ nodes: [store], edges: [] });
const changed = updateEditor(editor, {
  type: 'NodeArchitectureChanged',
  id: store.id,
  architecture: { family: 'ddd', role: 'repository' },
});
const restored = updateEditor(changed, { type: 'UndoPressed' });
```

`ZlozNodeArchitecture` is a discriminated union. C4 roles are `person`,
`software-system`, `container`, `component`; only containers/components carry
`technology`. DDD roles are `entity`, `value-object`, `aggregate-root`, `aggregate`,
`domain-event`, `domain-service`, `repository`, `bounded-context`. Bounded contexts
may classify their `subdomain` as `core`, `supporting` or `generic`. These are
diagram semantics, not domain identity or executable business invariants.
`architectureNodePresets` is a frozen typed catalogue of names and default shapes.

`createArchitectureNode` validates/detaches a standalone node and picks a catalogue
shape when omitted. Supply IDs, dimensions, ports and `kind` yourself. An aggregate
must be a portless group. Groups can represent C4 system/container and DDD
aggregate/context boundaries; group shapes remain rectangular. A context-map
bounded context can instead be a normal port-bearing node. Assemble parenting
with a complete graph, rather than referencing missing parents in the factory.

`architecture` and `appearance` are optional node fields; consumer `data` is
untouched. A role alone does not alter geometry. `appearance.shape` explicitly
chooses `rectangle`, `rounded-rectangle` or `cylinder`. A Person preset uses a
rounded card; a person adornment is future renderer artwork. Semantic changes
preserve the selected shape. `NodeAppearanceChanged` edits the outline, and null
on either change event removes that descriptor. Both use read-only/gesture gates,
one-step Undo, revision/route invalidation and independent host policies:

```ts
import type { EditorPolicy } from '@opsydyn/foldkit-zloz';

const policy: EditorPolicy = {
  canChangeNodeArchitecture: (node, next, graph) => null,
  canChangeNodeAppearance: (node, next, graph) => 'Keep the approved notation',
};
```

Callbacks receive current and validated proposed nodes plus the current graph.
Returning a reason vetoes the whole change. Exact no-ops do not publish a new
revision/history; malformed descriptors throw `ZlozError` before commit.

`nodeShapeGeometry` returns local `bounds`, `contentBounds` and `outlinePath`;
render the outline in that authored coordinate system. Rounded corner radius is
`min(12, width/2, height/2)`; cylinder cap radius is `min(16, width/4, height/4)`.
Its safe content sits between both cap interiors and can be empty at tiny sizes.
`nodeShapeBoundaryPoint(node, side, offset)` projects onto the same outline in
world space. Layout, marquee and grouping keep the rectangular authored envelope;
`nodeShapeContainsPoint` is an optional precise outline hit test. No DOM state or
renderer registry is persisted.

`portAnchor(port, node)` resolves default side/offset ports onto the selected
outline. Omit the node to retain legacy rectangular normalized coordinates.
Explicit `port.anchor` always wins, including after a shape change or resize.
`portBoundaryPosition` projects along the routing hint onto the selected outline;
ELK rejoins authored anchors and force routing leaves the conservative envelope
before corridor search. Native/custom port contexts and anchor controls use the
same canonical coordinates. Snapping continues to author envelope coordinates;
it does not automatically constrain explicit anchors to a curved outline.

`PortAnchorReset` restores the same side at offset `0.5` through the existing
`canEditPort` position policy and Undo. Hiding optional controls does not disable
these package APIs or protection rules.

Version 1 documents accept the new optional descriptors and validate their
reserved fields strictly. Literal old/new fixtures and the pinned pre-contract
core (`ce978a2`) qualify retention through legacy rename/move/copy/paste/Undo and
export. Older code retains the fields but uses generic rendering and rectangular
geometry. Other serializers are not covered by that qualification.
Run `bun tools/check-zloz-architecture-compat.ts` from this repository to repeat
the pinned-core check. No migration or registry publication occurs here.

## DDD preset renderers

```ts
import {
  zlozView,
  zlozDddNode,
  zlozDddGroup,
  createZlozNodeBodyCache,
  type ZlozDddNodeOptions,
} from '@opsydyn/foldkit-zloz/foldkit';

// Keep options and cache stable per canvas. Call with or without a cache.
const dddOptions: ZlozDddNodeOptions<Message> = {
  bodyCache: createZlozNodeBodyCache(),
  renderBadge: ({ architecture }, h) =>
    architecture.role === 'aggregate-root' ? h.span([], ['Consistency owner']) : null,
};
const canvas = zlozView(h, model.editor, {
  id: 'domain',
  label: 'Ordering domain',
  onEvent: (event) => Message.ObservedZlozInput({ message: event }),
  renderNodeShell: (context, h) => zlozDddNode(context, h, dddOptions),
  renderGroupShell: (context, h) => zlozDddGroup(context, h, dddOptions),
});
```

The adapter renders all eight existing DDD roles: entity, value object, aggregate
root, aggregate, domain event, domain service, repository and bounded context.
Aggregates and explicit bounded-context groups are portless boundaries; ordinary
context nodes can connect through their ports. Other families return undefined,
allowing normal rendering or a composed C4 fallback. DDD meaning does not force
an outline or color notation; authored appearance uses core geometry.

`ZlozDddContentContext` provides the node, narrowed DDD architecture, selection
and preview state. `renderBadge`, `renderType`, `renderName`, `renderSubdomain`,
`renderDescription` and `renderBody` customize inert content: undefined keeps the
default, null omits it. The badge is omitted by default. Bounded contexts display
optional subdomain classification. Compact group headers omit descriptions by
default; custom slots can display them with suitable authored space.

Use `renderControls` for interactive content outside the native drag button and
body cache; undefined keeps native context/collapse/resize controls and an empty
array omits them. `attributes` owns classes and paint; Model geometry stays
authoritative. Retain ports from the render context to preserve custom sockets
and current policy reasons. Scoped theme tokens support light/dark and host
themes. Minimal mode hides diagnostics, not the model's semantic role labels;
slots can independently omit those labels while native selection names remain.
Keep artwork callbacks inert and options stable when using `bodyCache`.

These views introduce no saved fields or business-rule enforcement. Use the
headless `architectureNodePresets` catalogue to compose a role legend or palette.
Atomic pattern insertion and typed DDD relationships are separate roadmap slices.

## C4 preset renderers

```ts
import {
  zlozView,
  zlozC4Node,
  zlozC4Group,
  zlozLightTheme,
  zlozDarkTheme,
} from '@opsydyn/foldkit-zloz/foldkit';

const canvas = zlozView(h, model.editor, {
  id: 'architecture',
  label: 'Order platform · system context',
  onEvent: (event) => Message.ObservedZlozInput({ message: event }),
  renderNodeShell: zlozC4Node,
  renderGroupShell: zlozC4Group,
  theme: model.dark ? zlozDarkTheme : zlozLightTheme,
});
```

The package draws C4 Person, Software System, Container and Component nodes, and
system/container group boundaries. Other families return undefined and use the
normal renderer. Use authored dimensions and `appearance` from the headless
contract; a semantic role alone does not replace a document's outline. The Person
glyph fits inside its card. Cylinders use the core's `outlinePath` and
`decorationPaths`; no second shape calculation lives in the view.

The presets retain native focus/selection, movement, ports, policy reasons,
context actions, collapse and resize controls. Content uses safe core bounds
inside the authored height; increase dimensions for long descriptions. External
scope uses both text and dashes. Scoped Zloz tokens control paint in light/dark
or host/Pleat themes. Theme changes do not alter the document or history.

`ZlozC4NodeOptions<Message>` exposes `renderIcon`, `renderType`, `renderName`,
`renderTechnology`, `renderDescription` and `renderBody`. Undefined keeps the
default part; null omits it. These slots supply **inert** content inside the native
drag button. Omitting visible names preserves native accessible selection names.
`renderBody` replaces content inside the canonical outline. Use a complete shell
and the public primitives when replacing the whole structure.

`attributes` customizes frame classes and paint while Model bounds remain
authoritative. `renderControls(context, h)` supplies live interactive content
outside artwork; undefined keeps native chrome and `[]` omits it. Use the view's
`renderPort` to customize or hide sockets independently. Semantic content remains
visible in minimal mode; it is not a measurement diagnostic.

Optional `bodyCache` accepts `createZlozNodeBodyCache()`. Create it once per canvas
and keep the options object/slot functions stable for reuse. Artwork keys include
the builder, node, selection/preview and options; they exclude full EditorState,
source feedback and port authorization. Controls and ports evaluate current
context even when artwork is retained. Changing a slot's captured inputs requires
a new immutable options object; cache-hit counts or universal speedups are not
claimed.

The Astro workbench's **Open C4 system context** and **Open C4 container view**
buttons demonstrate separate abstraction levels through these package exports.
The container view includes a portless boundary and a curved data-store anchor.
These are authored examples; atomic pattern insertion is not implemented yet.

## FoldKit view

```ts
import { zlozView } from '@opsydyn/foldkit-zloz/foldkit';
import type { EditorEvent, EditorState } from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

function view(h: HtmlBuilder<EditorEvent>, editor: EditorState) {
  return zlozView(h, editor, {
    id: 'my-flow',
    label: 'Workflow editor',
    onEvent: (event) => event,
    renderNode: (node, builder) => builder.p([], [node.label]),
  });
}
```

Use a document-unique `id`. Custom nodes use the parent's builder and normal
FoldKit messages. Inputs, textareas, selects and editable content keep their normal
behaviour. Add `data-flow-no-drag` to custom interactive areas as needed. Native
input and ResizeObserver resources are acquired by Mount and released on unmount;
input observation stops while DevTools displays a historical view. Resuming input
cancels any unfinished gesture retained in that Model snapshot.

- Drag node titles; Shift-click titles to select several. Drag the background to pan.
- Scroll over the surface to zoom around the pointer (0.1–4× by default). The surface owns touch
  gestures; this initial version supports one pointer, not pinch zoom.
- Tab to titles; Enter/Space selects and arrow keys move. Shift uses larger steps.
- Activate an output port, then an input port, by mouse or keyboard to connect.
- Escape cancels. Delete removes selected nodes and their incident edges together.
- Cmd/Ctrl+Z undoes; Shift+Cmd/Ctrl+Z or Ctrl+Y redoes. Text fields retain native undo.
- Connection buttons below the surface provide keyboard selection of edges.

The view measures node content. Width is controlled by `node.size.width`; height
follows content, with a 64px minimum. Fit through `fitViewport(graph, editor.surface)`
after the surface has reported dimensions. Zoom limits can prevent fitting extremely
large graphs. When replacing a document on an existing mounted surface, preserve
`editor.surface` (as the example's load handler does). Read-only editors retain
selection and viewport navigation.

Styles use ordinary HTML, inline geometry, and optional CSS variables:
`--flow-background`, `--flow-node-background`, `--flow-node-color`. No CSS import or
module registration is needed. Custom node content must remain accessible.

## Optional layout

Create a `layoutRequest(editor, uniqueRequestId)`, store it as the active request,
then run your chosen `LayoutEngine` in a Command. On completion pass the **current
active request** to `applyLayout(editor, active, result)`. The result is accepted
only if the request ID and revision still match and no gesture is active. Clear
the active request when loading/replacing a document; request IDs must not be reused
while old results can still arrive. Rendering never starts layout work.

Manual positioning has no layout dependency. The adapter receives a detached
snapshot; it cannot mutate the Model. All node positions are required exactly
once. Routes are optional, keyed by edge ID; node movement invalidates them and
the view uses straight lines until another arrange result is applied.

## Example and checks

Run `bun run --filter @opsydyn/web dev` and open `/flow` for custom text controls,
connections, ELK arrange, undo, save and reload. Storage belongs to that example.

```sh
bun run --filter @opsydyn/foldkit-zloz typecheck
bun run --filter @opsydyn/foldkit-zloz test
bun run --filter @opsydyn/foldkit-zloz pack:check
```

Initial scope: flat graphs, click-to-connect, single-pointer editing and bounded
history. Collaboration, execution,
virtualization and general layout algorithms are future work. Automated browser
checks do not establish assistive-technology or physical-touch acceptance.

Use `NodeWidthChanged` to commit an authored width while the view continues to
measure content height. `EdgeDataChanged` commits application-owned JSON metadata.
Both participate in undo/redo and graph serialization. The FoldKit view's
`edgeAppearance` callback can read edge data to customize stroke, width and dash
pattern. The editor still highlights the selected edge.

Use `renderEdge(context, h)` for custom SVG decoration along `context.path`.
The context includes the edge, label position, selection state, resolved
stroke, width and dash array, and an arrow marker reference. Return
`undefined` to draw the built-in edge. Keep custom SVG decorative and draw it
along the supplied path so Zloz's hit area, reconnect handles, and editable
label stay aligned. The SVG is hidden from assistive technology. Put
interactive controls in the host view.

Edge labels appear at the midpoint of the rendered path, including routed
edges. Select an unlabeled connection and choose **Add label**, or activate
an existing label to edit it. Enter saves, Escape cancels, and saving a blank
label removes it. Saving is one undo step. Read-only views display saved labels.

Use `renderEdgeLabel` for a custom badge and `renderEdgeLabelEditor` for an
inline editor. Each hook receives the edge, selection state, endpoint
description, and the same world anchor used by the default label. The editor
also receives the current draft. The view positions both in a protected HTML
layer on the canvas, so pointer and keyboard input inside a label can be used
without triggering canvas gestures.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderEdgeLabel: (context, h) =>
  zlozEdgeLabelBadge(h, context, onEvent, [h.Class('relation-badge')], [
    context.edge.label || 'Add label',
  ]),
renderEdgeLabelEditor: (context, h) =>
  zlozEdgeLabelForm(h, context, onEvent, [h.Class('relation-editor')], [
    zlozEdgeLabelInput(h, context, onEvent, []),
    h.button([h.Type('submit')], ['Apply label']),
    zlozEdgeLabelCancel(h, context, onEvent, [], ['Discard']),
  ]),
```

Pass the same `onEvent` mapping used by `zlozView`. The badge is a native edit
button in editable views and static text in read-only views. The form handles
submit and Escape, while the input reads and updates the Model draft. Return
`undefined` from either hook to use the default. Return `null` from
`renderEdgeLabel` to hide the badge while retaining any enabled Rename action.
The hooks require a resolved label anchor. Saved labels and selected editable
unlabeled edges are eligible for the badge hook.

Set an edge's optional `pathStyle` to `straight`, `stepped`, or `smooth`.
These styles draw between the current ports and take precedence over layout
routes. `EdgePathStyleChanged` saves the style in one undo step. Pass
`pathStyle: null` in that event to restore automatic routing. Automatic uses the
layout route when available and a straight line otherwise.

Supply `renderWorldOverlay` to draw annotations and domain visuals in diagram
coordinates. Its context includes the visible nodes and edges, selection,
viewport, and measured surface. The layer shares the node transform and is
clipped to the canvas. Return `null` or `undefined` to omit it. Overlay
visibility is controlled by the host, including in minimal mode.

Use `zlozWorldOverlayItem` from `@opsydyn/foldkit-zloz/foldkit` to anchor
HTML at a world point. Decorative items pass pointer input through by
default. Set `interactive: true` for native controls that handle their
own input while Zloz's canvas gestures and shortcuts stay out of the way.

```ts
renderWorldOverlay: (_context, h) =>
  zlozWorldOverlayItem(h, { position: { x: 180, y: 60 } }, [], [
    h.span([], ['Review required']),
  ]),
```

With `nodeToolbar: true`, selecting one visible node or group shows **Duplicate
node** and **Delete node**. The toolbar follows the node in screen space and
keeps its size as you zoom. Supply `nodeToolbar: { placement: 'bottom', offset: 12 }`
to choose a side and a gap in CSS pixels. The default places it above the
node and switches below when the node is near the top. The canvas clips the
toolbar at its edges.

`renderNodeToolbar` receives the visible node, viewport, screen-space anchor,
and action descriptors. Compose native buttons with `zlozContextAction`, or
use your own FoldKit controls. Return `undefined` for the default contents
or `null` to suppress the toolbar for that selection. Deletion uses the same
`canDelete` policy as the keyboard and context actions. The toolbar is an
editing control, so it can appear in minimal mode when enabled.

Enable `edgeToolbar: true` to show Rename, path style, and Delete edge
controls beside a single selected edge. In the Connections list, activate an
edge and press Up Arrow to focus its actions. The toolbar uses native controls
and stays the same size as the canvas zooms. Deleting from the toolbar removes
only that edge and can be undone.

Add `edgeReconnection: true` to opt into native Source port and Target port
choosers in that toolbar. Pass the same `canReconnect`, `canConnectPort` and
`canConnect` policies used by `updateEditor` to the view. The chooser is an editing
control and remains available in minimal mode; protection explanations remain
visible even when optional diagnostics are disabled. The expanded toolbar offers
up to 320 px width and scrolls within the canvas.

Enable `connectionCreation: true` for a native source/target chooser above the
canvas. Pass the same `canConnectPort` and `canConnect` policies used by
`updateEditor`. The panel is opt-in and independent of optional diagnostics, so
it remains operable in minimal mode. `renderConnectionCreation(context, h)`
replaces its layout; return `undefined` for native defaults or `null` to omit it.

For a standalone inspector, use the pure resolver and the FoldKit panel:

```ts
import { resolveConnectionCreation } from '@opsydyn/foldkit-zloz';
import { zlozConnectionCreation } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveConnectionCreation(model.editor, policy);
const panel = zlozConnectionCreation(h, context, onEvent, { idPrefix: 'my-create' });
```

The context exposes `source`, `target` and `cancel`. Source choices check output
permissions and send `PortActivated` to stage `EditorState.connection`, without
adding history. Target choices check both ports, direction, duplicates and the
global connection policy. They send the same event through the reducer, which
rechecks the current graph/policy, allocates a fresh ID and creates one Undo step.
No second draft or preallocated edge ID is stored by the chooser. Canvas port
activation and the chooser operate on the same pending source.

Choices have stable endpoint values, labels, current/hidden flags, nullable
reasons and typed activation events. Visible alternatives are the default, with
the pending source retained even when hidden. Pass `{ scope: 'all' }` to the
resolver, or `connectionCreation: { scope: 'all' }` to the view, to include all
authored ports. Recompute contexts each view and keep policy callbacks pure.

Use `zlozConnectionCreationField`, or compose `zlozConnectionCreationSelect`
and `zlozConnectionCreationReasons` with the same `idPrefix`, for custom layouts.
`zlozConnectionCreationCancel` supplies a native cancel button. Distinct widgets
need distinct prefixes. `optionLabel` customizes native option text; richer
widgets can consume the headless entries directly. Field `reason` blocks editing;
`hint` explains an unselected source or an empty candidate set without removing
the field from keyboard navigation. Preserve required descriptions in custom UI.

Completing a connection resets both fields to their placeholders and retains
focus on the target. Native type-ahead and Tab remain available. Escape from a
chooser with an active pending source cancels it; the placeholder and Cancel
button also cancel. Cancellation adds no history. Explicit read-only, gesture
and source-port restrictions still disable the affected fields. Existing Undo
and Redo retain their usual selection behavior.

For a custom inspector, derive the choices from the core and compose the native
field from `@opsydyn/foldkit-zloz/foldkit`:

```ts
import { resolveEdgeReconnection } from '@opsydyn/foldkit-zloz';
import { zlozEdgeEndpointField } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveEdgeReconnection(model.editor, edgeId, 'target', policy);
const field = context
  ? zlozEdgeEndpointField(h, context, onEvent, { idPrefix: 'my-inspector' })
  : h.div([], ['Connection no longer exists.']);
```

`resolveEdgeReconnection` returns `null` for an absent edge. It enumerates ports
of the matching direction, excluding hidden/collapsed alternatives by default
and always retaining the current endpoint. Pass `{ scope: 'all' }` to include
hidden alternatives, including via `edgeReconnection: { scope: 'all' }` in the
view. Hidden current endpoints are labeled; missing current ports remain visible
as unavailable. The resolver does not change visibility, selection or the graph.

Each entry contains a stable `value`, endpoint, label, current/hidden flags,
nullable protection `reason`, and typed `EdgeReconnected` event. Values encode
the node/port pair rather than its index, so reordering cannot retarget a choice.
`context.reason` explains read-only, active-gesture or endpoint-lock states.
`context.emptyReason` explains when no eligible alternatives remain; the unchanged
current choice stays focusable so an accepted edit does not unexpectedly drop focus. Candidate reasons share the reducer's direction, port,
duplicate and global connection checks. The replaced edge is excluded from the
global policy's graph; only the changing port is checked for new-port permission.
The unchanged endpoint is a no-op. Policy functions must be pure, since rendering
evaluates them for multiple candidates. Recompute contexts each view; events are
proposals and the reducer rechecks current policy when committing.

Use `zlozEdgeEndpointSelect` and `zlozEdgeEndpointReasons` separately to build
your own layout, passing the same `idPrefix` to both. Distinct simultaneous fields
for the same edge end need distinct prefixes. The select supplies a stable key,
ID, accessible name and description, disabled states and native change behavior.
`optionLabel` customizes native option text; fully custom widgets can consume the
headless entries. Required protection copy is available as data and through the
reasons primitive, independently of optional diagnostic readouts. Preserve that
association in custom designs. `renderEdgeToolbar` receives optional
`context.reconnection` with both endpoint contexts and a scoped `idPrefix` when
enabled. Native Tab/selection behavior is preserved; each accepted change is one
Undo step, with edge metadata, selection and focused chooser retained.

### Searching and grouping endpoint choices

Both creation and reconnection field/select/reasons options accept `query` and
`groupByNode`. Filtering is a view projection: keep query text in the host Model
and pass the same options to the select and reasons. Flat, unfiltered lists remain
the default. Native groups use node identity, preserving separate groups for
nodes that share a label. `groupLabel` customizes group text; `optionLabel` still
customizes each option.

`resolveEndpointChoices(entries, { query })` is exported from the pure core for
custom widgets. It returns filtered `entries`, node `groups`, `matchCount` and
nullable `emptyReason`. Matching uses literal, case-insensitive substrings for
every whitespace-separated token across labels and endpoint IDs. It preserves
entry/event references and input order, and always retains current selections,
even when hidden, protected or nonmatching. `matchCount` excludes those retained
nonmatches. Group order follows the first visible entry for each node. Entries
from the built-in resolvers include optional `nodeLabel` metadata; older/custom
entries fall back to the node ID.

Compose the native query primitives from `@opsydyn/foldkit-zloz/foldkit`:

```ts
const options = { query: model.portQuery, groupByNode: true, idPrefix: 'target' };
const search = resolveEndpointChoices(context.entries, options);
const searchOptions = { idPrefix: 'target-filter', label: 'Search target ports' };
const changed = (query: string) => Message.ChangedPortQuery({ query });

const controls = [
  zlozEndpointSearchInput(h, search, changed, [], searchOptions),
  zlozEndpointSearchClear(h, changed),
  zlozEndpointSearchFeedback(h, search, [], searchOptions),
  zlozEdgeEndpointField(h, context, onEvent, options),
];
```

Use `zlozConnectionCreationField` with the same options for creation. Supply
distinct search prefixes for simultaneous widgets, pairing input and feedback
with the same prefix. Escape in the search input clears only its query and keeps
focus; Escape on a creation select retains its existing cancellation behavior.
The Clear button remains focusable after clearing. Query changes do not stage a
source, edit the graph or add Undo entries.

No-match feedback is associated with the input and select. The feedback primitive
accepts attributes so a custom layout can keep its live region available while
showing a single visible explanation through the operation's reasons primitive.
Global protection reasons remain visible regardless of filtering; matching denied
choices stay disabled, and current selections remain recognizable. Empty creation
results retain the placeholder, preventing implicit selection of another port.
Filtering cannot widen the resolver's visibility scope or authorize an edit: the
existing reducer rechecks the current graph and policies on every commit. Search
and grouping do not virtualize the list or reduce the resolver's policy workload.

### Custom edge toolbars

With `edgeToolbar: true`, supply `renderEdgeToolbar` to arrange, style, or
omit individual actions. Its context contains the selected edge, the shared
label anchor in world coordinates, and the typed actions `rename`,
`deleteEdge`, and `changePathStyle`. Use the package primitives or send the
events through the same `onEvent` mapping as the canvas.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderEdgeToolbar: (context, h) =>
  h.div([h.Class('edge-actions')], [
    zlozEdgePathStyleSelect(h, context, onEvent, []),
    zlozEdgeToolbarButton(h, context.actions.deleteEdge, onEvent, [], ['Delete edge']),
  ]),
```

The positioned frame keeps the same screen-space placement as the default
toolbar and offers up to 256 px of width. Arrow Up from the selected connection
focuses the first available control in DOM order, or the group itself when
there are no eligible controls. Return `undefined` for the default layout or
`null` to hide the toolbar and its keyboard shortcut for that edge.

With `contextActions: true`, use `renderContextMenu` to replace the contents of
the node, group, or edge context panel. The context is discriminated by
`kind` and contains the selected item, surface point, and typed actions.
Group contexts include fit, aspect ratio, and dimension editing. The package
still owns panel placement, the accessible group, and input handling.

```ts
// Import the primitives from @opsydyn/foldkit-zloz/foldkit.
renderContextMenu: (context, h) =>
  h.div([h.Class('context-panel')], [
    ...(context.kind === 'edge'
      ? [zlozContextAction(h, context.rename, onEvent, [], ['Rename'])]
      : [zlozContextAction(h, context.duplicate, onEvent, [], ['Duplicate node'])]),
    zlozContextAction(h, context.close, onEvent, [], ['Close']),
  ]),
```

Use `zlozContextDimensionInput` for a native number field with the current
value, grid step, and disabled state. The group's `showMeasurements` flag
carries the effective diagnostics preference. Return `undefined` to use the
default content. On opening, Zloz focuses the first focusable control or the
panel itself. Escape returns focus to the canvas. Clicking or moving focus
outside dismisses the panel.

Use `renderConnections` to arrange the visible edges in a custom list. The
context provides their selected state, endpoint labels, optional context
actions, and whether the list is compact or read-only. Zloz owns the named
Connections group and its compact disclosure, and calls the renderer only
when the list is open. Edges hidden inside collapsed groups are filtered
before the renderer runs.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderConnections: ({ entries }, h) =>
  h.ul([], entries.map((entry) =>
    h.li([h.Key(entry.edge.id)], [
      zlozConnectionButton(h, entry, onEvent, [], [entry.label]),
      ...(entry.contextAction
        ? [zlozContextTrigger(h, entry.contextAction, onEvent, [], ['⋯'])]
        : []),
    ]),
  )),
```

The selection button includes Arrow Up to the active toolbar and Shift+F10
or the Context Menu key when context actions are available. Return
`undefined` for the default list.

Use a group's **Collapse** and **Expand** buttons to change its canvas
presentation. A collapsed group hides its descendants and internal edges.
Connections that cross the boundary remain visible and attach to the compact
group. Expand the group to access its individual ports. Collapsing and
expanding also work in read-only views. They are editor-session actions and
leave saved documents and undo history intact.

Set `resizeHandles: true` on the FoldKit view to enable pointer resizing.
Card handles adjust width while height follows content. The drag range is 140
to 320 graph units, extended to include an existing width outside that range.
Escape or pointer cancellation restores the starting width. Releasing commits
one undo step. Provide a keyboard control via `NodeWidthChanged` when enabling
handles in an editable view.

Selected expanded groups show four corner handles and four midpoint side handles.
Corners adjust width and height; unlocked sides adjust only their own axis.
The opposite corner stays anchored and children keep their canvas positions. Shrinking stops at the contents
plus 24 units of padding, with a minimum of 224 × 96 (or the starting dimensions
when already tighter). Parent containment clamps
growth unless `expandParent` enables ancestor expansion. Focus the handle and use
arrow keys to adjust by 5 graph units, or Shift+Arrow by 20. With grid snapping
on, these steps are one and four grid intervals respectively. Each keyboard action
is one undo step; pointer drags commit once and Escape restores the original
bounds. Hosts can dispatch `GroupResizeNudged` with an `id` and `{ x, y }` delta.
Collapsed and read-only groups cannot be resized.

Drag from an output port to see a preview and highlight an eligible input.
You can also activate an output and then an input with Enter or Space.
The editor announces completion or cancellation in its status region.

Send `EdgeReconnected` with an edge ID, the end to replace, and the new port.
The editor checks port direction, duplicates, and the connection policy before
committing one undo step. The policy receives the proposed edge and the graph
with the previous version of that edge removed.

### Scoped themes and Pleat

Pass `theme: zlozLightTheme` or `theme: zlozDarkTheme` to a FoldKit view.
The presets cover the canvas, nodes, groups, ports, edges, and interaction
feedback. Each also sets the color scheme for native controls within that
editor. The presets and the typed token contract are exported by
`@opsydyn/foldkit-zloz/foldkit`.

```ts
import { zlozDarkTheme, type ZlozTheme } from '@opsydyn/foldkit-zloz/foldkit';

const theme: ZlozTheme = {
  ...zlozDarkTheme,
  tokens: { ...zlozDarkTheme.tokens, selection: 'var(--app-accent)' },
};
```

Explicit `theme.tokens` take precedence over class values for the same
tokens. Supply a partial token object to inherit the other variables from
the host. The editor's theme can change on any render without recreating
its state.

Set `themeClassName` on a Zloz view to scope a theme to that editor. Existing
CSS variables still inherit from ancestors. A host using Pleat can combine a
class from `cssClass()` with a CSS class that maps its semantic theme tokens
to the Zloz variables. Pleat owns the host theme and style registration.

| Part        | CSS variables                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas      | `--flow-background`, `--flow-canvas-border`, `--flow-grid-line`, `--flow-grid-dot`                                                       |
| Node        | `--flow-node-background`, `--flow-node-color`, `--flow-node-border`, `--flow-node-radius`                                                |
| Ports       | `--flow-input-port`, `--flow-output-port`, `--flow-port-border`, `--flow-control-color`                                                  |
| Edges       | `--flow-edge`, `--flow-edge-width`                                                                                                       |
| Interaction | `--flow-selection`, `--flow-valid-target`, `--flow-resize-background`, `--flow-resize-readout-background`, `--flow-resize-readout-color` |

For example, given a Pleat theme that exposes the app's semantic CSS tokens:

```css
.release-flow-theme {
  --flow-background: var(--app-surface);
  --flow-node-background: var(--app-panel);
  --flow-node-color: var(--app-text);
  --flow-selection: var(--app-accent);
}
```

Pass `themeClassName: 'release-flow-theme'` in the Zloz view options. To apply
a Pleat style directly to the root as well, append its `cssClass(style)` result.
A per-edge `edgeAppearance` stroke or width takes precedence over the default
edge tokens, and the selection token controls the selected stroke.
See [Pleat's FoldKit and theme APIs](https://github.com/Manzanita-Research/pleat#theming).

Select an edge to expose its available endpoint handles. Drag a handle to a
compatible port to reconnect the edge. Escape or dropping elsewhere cancels.

Set `portLabels: true` on `zlozView` to show each port's `label`, falling
back to its ID. Labels use the canonical world anchors and follow node
visibility, collapse, and viewport culling. They stay visible in minimal
mode while opted in. Set `portLabels: false` to hide them.

Use `portLabels: { offset: 24, placement: 'right' }` to customize the
default gap and side. Without a placement, each label follows its port's
routing side. The offset is in world units and defaults to 18.
`renderPortLabel(context, h)` replaces a complete label. Return
`undefined` for the default or `null` to omit an individual label.
Compose `zlozPortLabel(h, context, attributes, children)` for custom badges
and per-port placement. It owns the anchored frame and passes pointer input
through. Labels render independently of custom node and group shells.
Keep them decorative. The port button retains its accessible name.

Use `renderPort(context, h)` to replace the native port presentation.
Compose `zlozPort(h, context, context.port, attributes, children)` to
keep its anchor, accessible name, keyboard activation and connection
policy. The context supplies the label, normalized anchor, active state,
accepted target state and disabled reason. Return `undefined` for the
default control or `null` to omit one control. Use `canConnectPort` to
govern whether a connection is allowed.

Custom node and group shells can append `context.ports ?? []` as direct
frame children to use the configured renderer. Existing shells that
construct their own ports continue to own their presentation. Custom port
rendering uses the normal node view path alongside the existing culling
option. The built-in node-view cache applies to standard port rendering.

Add a port with `{ type: 'PortAdded', nodeId, port }`. The host supplies
its ID, direction, label and position. Invalid ports, duplicate IDs and
unknown nodes fail before publication. Caller-owned anchors are detached.

Change display text with `{ type: 'PortLabelChanged', endpoint, label }`.
The endpoint ID, direction, position and attached connections stay unchanged.
Pass `undefined` to remove the label and restore the port-ID fallback.
Strings are preserved exactly, including empty strings. Identical labels
and missing endpoints are no-ops; invalid labels fail graph validation.
Each accepted change is one Undo transaction and respects read-only and
active-gesture guards. Hosts own any draft UI and decide when to commit.

Remove a port with `{ type: 'PortRemoved', endpoint }`. Its attached
connections are removed in the same transaction. `canDelete` evaluates
the complete attached-edge set and can veto the whole operation.
`resolvePortRemoval(graph, endpoint, canDelete)` provides the same
decision for host controls. Removing a missing port is a no-op.

Each accepted operation creates one Undo entry, invalidates stale layout
routes, and respects read-only and active-gesture guards. Port removal
does not call deletion policy when there are no attached edges. Existing
graph documents and snapshots already support the resulting port data.

Use `EditorPolicy.canEditPort` to protect direct port edits individually:

```ts
import type { EditorPolicy } from '@opsydyn/foldkit-zloz';

const policy: EditorPolicy = {
  canEditPort: ({ operation, node, port }) =>
    node.id === 'review' && port.id === 'in' && operation !== 'add'
      ? 'Review input is managed upstream.'
      : null,
};
```

`PortEditCandidate` contains `operation` (`add`, `label`, `position`, or
`remove`), the current node, and the current port. Addition supplies the
proposed port instead. This is a capability check, independent of proposed
label text or coordinates. The reducer evaluates it against the current
full graph before publishing. A veto preserves graph, routes, revision,
selection and history, and reports the reason in `notice`. One protected
port vetoes an entire position batch; unchanged labels and positions are
no-ops and skip policy checks.

`portEditReason(candidate, graph, policy.canEditPort)` resolves the same
trimmed reason for host controls; blank rejections use a default message.
For removal controls pass both policies:
`resolvePortRemoval(graph, endpoint, policy.canDelete, policy.canEditPort)`.
Port edit protection is checked first, including unused ports, followed
by attached-edge deletion protection. Wire creation/reconnection continue
to use the connection policies. Whole-node deletion, graph replacement,
and Undo/Redo retain their existing policies and history semantics.

The optional `/foldkit` entry point also exports composable port inspector
primitives. `portInspectorContext(editor, nodeId, policy, options)` returns
an Effect `Option` containing the node and its current entries, or `None`
for a missing node or group. Each entry includes `labelControl`,
`positionControl` and `removeControl`. Null `reason` enables a control;
non-null reasons include policy, read-only and active-gesture protection.
Render `entry.reasons` once: identical reasons share an ID across controls.
`ZlozPortInspectorOptions` accepts `idPrefix`, `readOnlyReason`, and
`busyReason`; give simultaneous inspectors distinct prefixes.

Hosts own their draft Model and messages. This standalone helper composes
a label form without prescribing a layout or CSS:

```ts
import type { HtmlBuilder } from 'foldkit/html';
import {
  zlozPortLabelForm,
  zlozPortLabelInput,
  zlozPortLabelSave,
  zlozPortLabelCancel,
  zlozPortProtectionReason,
  type ZlozPortInspectorEntry,
  type ZlozPortLabelFormMessages,
} from '@opsydyn/foldkit-zloz/foldkit';

export function portLabelEditor<M>(
  h: HtmlBuilder<M>,
  entry: ZlozPortInspectorEntry,
  draft: string,
  messages: ZlozPortLabelFormMessages<M>,
  changed: (text: string) => M,
) {
  return zlozPortLabelForm(
    h,
    messages,
    [],
    [
      zlozPortLabelInput(h, entry, draft, changed, []),
      zlozPortLabelSave(h, entry, [], ['Save']),
      zlozPortLabelCancel(h, messages.cancelled, [], ['Cancel']),
      ...(entry.labelControl.reason !== null
        ? [zlozPortProtectionReason(h, entry.labelControl, [])]
        : []),
    ],
  );
}
```

`zlozPortLabelEditButton` opens the host draft. Enter submits the form,
Escape cancels, and Cancel remains available when editing is protected.
The host's saved message commits `PortLabelChanged` with the current
policy; these view contexts are preflight information, not authorization
tokens. Recompute them on each view. The primitives own native types,
bindings, disabled state and description links. Attributes can customize
names, autofocus and styling; children can supply badges or other content.

`zlozPortRemoveButton` emits the entry's atomic `PortRemoved` event.
`portAdditionContext(editor, nodeId, proposedPort, policy, options)`
preflights a host-supplied proposal. `zlozPortAddButton` takes that context
and a host message so identity allocation can occur against the latest
Model in update, including rapid repeated clicks. All primitives are
unstyled and may be arranged or omitted independently. Position controls
can use the resolved `positionControl` and existing `PortPositionsChanged`.

Compose per-port position editing with `portPositionDraft(port)`,
`updatePortPositionDraft(draft, change)`, and `portPositionEditorContext`.
`ZlozPortPositionDraft` keeps unvalidated text in either `offset` or
`anchor` mode, so empty fields never become document coordinates.
`portPositionFromDraft` returns an Effect `Option<PortPosition>`: all
active numbers must be finite fractions from 0 to 1. Save commits that
complete position through `PortPositionsChanged` with the current policy,
giving side and coordinate changes one Undo entry. Hosts own draft
lifecycle and decide when to discard drafts after document changes.

Use `zlozPortPositionEditButton` to open a draft. Inside
`zlozPortPositionForm`, compose `zlozPortPositionModeSelect`,
`zlozPortPositionSideSelect`, `zlozPortPositionInput` for each item in
`context.inputs`, `zlozPortPositionSave`, and `zlozPortPositionCancel`.
The controls use `entry.positionControl`, native required/min/max
validation, Enter to save and Escape to cancel. They retain disabled
states and reason links while Cancel remains available. Attributes and
children control presentation; both selects also accept an optional
final record of custom option labels.

```ts
const context = portPositionEditorContext(entry, draft);
const fields = context.inputs.map((input) => zlozPortPositionInput(h, context, input, changed, []));
// Render fields in a host-owned layout inside zlozPortPositionForm.
```

Edge offset mode uses the side and an along-edge fraction. Box coordinates
use normalized X/Y from the node frame's top-left; side remains a routing
direction hint. Switching to box coordinates starts at the same cardinal
anchor. Switching back projects onto the chosen side using Y for left/right
and X for top/bottom. It intentionally returns the anchor to that edge.

Opt in to direct positioning with `zlozView`'s `portAnchorHandles: true`.
Selected visible nodes get separate anchor handles. Socket wiring keeps
its normal controls and connection policy. Pass `canEditPort` to both
the view and reducer so handles reflect the current position permission.
Read-only handles are disabled and protected handles carry their reason
as a native description. The selected-node inspector can render the same
reason visibly through its existing context.

Drag previews use normalized node-frame coordinates, clamp to 0–1, and
preserve the port's routing side. Pointer capture keeps tracking outside
the canvas. Release records one Undo entry; no-movement and out-and-back
drags preserve the original representation without history. Escape,
pointer cancellation, lost capture, or a policy/read-only veto restore
the starting document. Policy is checked at start, during movement and
again at release. Preview revisions invalidate stale routes; cancellation
does not consume redo history. Arrow keys nudge by 1%, or 10% with Shift,
using the same policy and normal Undo transactions.

`PortAnchorDragStarted`, `PointerMoved`, `PointerReleased` and
`GestureCancelled` are the headless gesture contract. `PortAnchorNudged`
accepts a normalized frame delta for keyboard or host controls.

Customize the native handle through `renderPortAnchorHandle` and
`zlozPortAnchorHandle`; null omits a handle and undefined uses the default.
`ZlozPortAnchorHandleContext` includes the node, port, normalized anchor,
world position, active state and rejection reason. The primitive belongs
in the world layer, so it works independently of custom node shells and
socket renderers. Attributes and children control its shape, size, copy
and contents. `portAnchorHandles: { offset: { x: 24, y: 0 } }` changes
the world-unit displacement from the socket; the default follows its
routing side and stays fixed throughout the drag. This bounded anchor gesture does not auto-pan
or change the side hint; the position editor handles side changes.

Opt in to edge attraction through the core editor:

```ts
const editor = createEditor(graph, { portAnchorSnapDistance: 12 });
```

The distance is in CSS pixels. Its default is zero, preserving free
placement. `PortAnchorSnapDistanceChanged` changes it while idle without
editing the document or history; invalid distances are ignored. Initial
options require a finite non-negative value. During an anchor drag, the
nearest frame edge within that radius attracts the position. Distances
account for node dimensions and viewport zoom. Exact ties prefer the
port's routing side, then left/right/top/bottom order. Only position is
snapped; the routing-side hint remains unchanged.

`resolvePortAnchorSnap(candidate, { size, zoom, distance, preferredSide })`
exposes the same pure calculation for headless consumers. It clamps raw
normalized candidates to the frame, returns `{ anchor, side }`, and uses
null side when attraction is disabled or no edge is close enough.
`PortAnchorSnapOptions` and `PortAnchorSnapResult` describe that contract.
Clicking without movement and out-and-back drags retain the starting
representation. Moving away from an edge releases its attraction. Policy
vetoes, cancellation and Undo retain the anchor drag's atomic behavior.

Active `ZlozPortAnchorHandleContext.snappedSide` identifies the attracted
edge. The default handle highlights it and updates its native description;
custom renderers can use the same context for their own feedback. This
session preference is independent of connection snapping and node-grid
snapping. Keyboard nudges and explicit numeric position edits remain exact
even when pointer attraction is enabled. The resolver attracts one edge at a time.

Set `portAnchorSnapHysteresis` in `EditorOptions` to stabilize an acquired
edge. The default is zero. A positive CSS-pixel margin extends its release
radius to `portAnchorSnapDistance + portAnchorSnapHysteresis`. A competing
edge must be inside the normal acquisition radius and closer by more than
the margin to take over. At the exact margin the current edge stays held.
Once released, an edge must enter the normal radius to acquire again.
Setting the edge snap distance to zero disables edge attraction.

`PortAnchorSnapHysteresisChanged` changes the margin while idle without
editing graph data or history. Initial options and the pure resolver
require finite non-negative values; invalid change events are ignored.
The pure resolver's optional `hysteresis` and `previousSide` fields support
the same behavior for headless consumers. Feed the previous result's side
back during a gesture; `preferredSide` remains only a routing-hint tie
breaker. The reducer carries retention in its existing gesture state.
Policy vetoes, cancellation, no-motion behavior, keyboard/numeric precision
and one-step Undo keep their existing semantics.

Set `zlozView`'s `portAnchorSnapBypassModifier: 'Alt'` to enable temporary
free positioning during an anchor drag. The default has no mapping.
`ZlozPortAnchorSnapBypassModifier` also accepts `Control`, `Meta` and
`Shift`, so hosts can choose their shortcut. The native resource captures
that mapping at pointer-down; changes apply to the next gesture.

Holding the mapped key bypasses edge/corner/midpoint attraction and hysteresis while
retaining frame clamping and edit policies. Pressing or releasing it
recomputes the last raw pointer sample in the Model, even without mouse
movement. Releasing performs fresh acquisition; it clears the old retained
edge. Releasing the pointer while holding the key commits the free position
as the drag's single Undo entry. Snap preferences stay intact. Blur,
Escape, capture loss and policy vetoes retain normal cancellation.

Headless consumers can supply `snapBypassed` on `PortAnchorDragStarted`,
`portAnchorSnapBypassed` on `PointerMoved`, or
`PortAnchorSnapBypassChanged` with the active pointer and `bypassed` value.
The gesture retains its raw `point` for key-only updates. These facts apply
only to the matching anchor gesture. A start fact can include the captured
`snapBypassModifier` for renderer hints. Handle contexts expose `snapBypassed`
and `snapBypassModifier` for custom feedback; the default uses a dashed
border and native description. Other gestures and idle keyboard nudges
retain their existing modifier behavior.

Set `portAnchorCornerSnapDistance: 12` in `EditorOptions` for corner
attraction within a circular 12 CSS-pixel radius. It defaults to zero,
independently of `portAnchorSnapDistance`, so corners can be enabled alone.
The candidate is clamped to the node frame first. With the default priority, a corner in range takes
priority over midpoint and edge attraction; outside the corner range, other
enabled modes or free placement apply. The radius stays constant at any zoom.

`PortAnchorCornerSnapDistanceChanged` changes the radius while idle without
adding document history. Values must be finite and non-negative; invalid
change events are ignored. Positive `portAnchorSnapHysteresis` also retains
an acquired corner within radius plus margin. A competing corner must be
in the acquisition radius and closer by more than the margin. Exact ties
keep the retained corner; without retention the stable order is top-left,
top-right, bottom-left, bottom-right. Corner acquisition takes priority over
retained edges, and a released corner can fall back to ordinary edge acquisition.

The pure `resolvePortAnchorSnap` accepts `cornerDistance` and
`previousCorner`. Feed its optional `corner` result back during a gesture;
`side` is null during a corner snap. `PortCorner` names the four corners.
`ZlozPortAnchorHandleContext.snappedCorner` exposes that feedback for custom
renderers. `zlozPortAnchorHandle` supplies a corner description and
`data-flow-anchor-corner`; the default handle adds a diamond and selection
border. Returning `undefined` uses the default, and `null` omits the handle.
Bypass clears all anchor snap retention and resumes fresh acquisition
on key release. The authored routing side and port identity stay intact;
previews, cancellation, current edit protection and one-step Undo/Redo
share the existing anchor-drag transaction. Keyboard nudges and numeric
edits stay exact. These are session preferences, not serialized graph fields.

Set `portAnchorMidpointSnapDistance: 12` in `EditorOptions` to attract
port anchors to exact edge centers: left `(0, 0.5)`, right `(1, 0.5)`,
top `(0.5, 0)` and bottom `(0.5, 1)`. The circular CSS-pixel radius defaults
to zero and works independently of corner and edge attraction. The
candidate is clamped before measuring distance, and zoom does not change
the radius. By default, corners take priority over midpoints; midpoints take priority
over edges, including retained edges. Outside a retained midpoint's band,
normal acquisition in the remaining enabled modes applies.

`PortAnchorMidpointSnapDistanceChanged` changes the radius only while idle
without changing graph/history. Initial/resolver values must be finite
and non-negative; invalid change events are ignored. The shared
`portAnchorSnapHysteresis` extends a midpoint's radial release band and
requires a competing midpoint to win by more than the margin. The routing
side breaks acquisition ties, followed by left, right, top, bottom.
With corners-first priority, an eligible corner also takes priority over a retained midpoint.

Headless consumers pass `midpointDistance` and `previousMidpoint` to
`resolvePortAnchorSnap`. Its optional `midpoint` result is a `PortSide`;
`side` is null during midpoint attraction. Feed the result back for
retention. `ZlozPortAnchorHandleContext.snappedMidpoint` supports custom
badges via `zlozPortAnchorHandle`; the helper supplies a midpoint
description and `data-flow-anchor-midpoint`. The default handle shows a
center marker. Bypass clears midpoint retention too, including stationary
key transitions, and resumes fresh acquisition. Precise release, policy
rollback, cancellation and single-step Undo/Redo retain the same drag
transaction. Authored routing direction, keyboard nudges, explicit position
edits and graph serialization retain their existing semantics.

Use `EditorPolicy.portAnchorSnap` to override snapping for individual ports:

```ts
const policy: EditorPolicy = {
  portAnchorSnap: ({ node, port }, graph) => {
    if (node.id === 'review' && port.id === 'in')
      return { distance: 0, cornerDistance: 0, midpointDistance: 18, hysteresis: 6 };
    if (port.id === 'precise') return { distance: 0, cornerDistance: 0, midpointDistance: 0 };
    return undefined;
  },
};
const next = updateEditor(state, event, policy);
```

The callback receives the current node, port and full graph at an allowed
anchor drag's start. `PortAnchorSnapOverrides` accepts `distance` (edges),
`cornerDistance`, `midpointDistance` and `hysteresis`, in CSS pixels. Missing
or undefined fields inherit editor settings; zero explicitly disables that
rule. Returning `undefined` inherits every setting. Overrides can enable
attraction even when editor defaults are zero. The optional `priority` field
can change point-kind ordering; edges remain the final fallback. The pure `resolvePortAnchorSnapSettings(defaults, overrides)`
helper returns a detached `PortAnchorSnapSettings` record, filling absent
defaults with zero and validating finite non-negative effective values.
Invalid settings throw `ZlozError` before any gesture, graph or history change.

Effective settings are captured in `gesture.snapSettings`, including
inherited values. Mutating a returned override or changing the host policy
affects the next drag. The callback is not re-evaluated during previews,
bypass transitions or rendering. Custom handle contexts expose a detached
`snapSettings` record while that port is actively dragged; it is absent
while idle. This supports custom rule feedback without repeating the policy.
The view reads the Model; no additional `zlozView` configuration is needed.

Supply the current policy to `updateEditor` as usual: `canEditPort` remains
authoritative at start, preview and release. Snap overrides cannot bypass
protection, clamping, cancellation or the single Undo/Redo transaction.
Modifier bypass temporarily disables all attraction while preserving the
captured preferences. Keyboard/numeric edits stay exact. Policies and
captured preferences are runtime/editor state, not serialized graph fields.

`PortAnchorSnapTargets` adds optional `allowedEdges`, `allowedCorners` and
`allowedMidpoints` lists to overrides, effective settings and the pure snap
resolver's options. For left/right midpoints only, a policy can return:

```ts
{ distance: 12, cornerDistance: 12, midpointDistance: 18,
  allowedEdges: [], allowedCorners: [], allowedMidpoints: ['left', 'right'] }
```

Missing/undefined lists allow all targets of that kind. Empty lists disable
the kind even with a positive radius. The settings helper inherits lists
from its defaults when supplied, and an explicit list replaces the default
list. Supply all four names to restore all targets. Edges/midpoints accept
`PortSide` names; corners accept `PortCorner` names. Invalid names or non-array
values throw `ZlozError` before starting a gesture, including when a radius
is zero. Duplicate names are normalized into canonical order. Array order
does not change established tie-breaking or corner/midpoint/edge priority.

Only allowed candidates participate in nearest-target selection and
hysteresis; a forbidden previous target cannot remain held. Bypass still
disables all attraction. These lists govern attraction: free placement,
frame clamping, keyboard nudges and numeric edits retain their behavior.
They do not constrain the authored port position or routing direction.

The settings helper and drag start detach every target list. Host list
changes affect the next drag. Active handle `snapSettings` also receives
detached lists for custom feedback, without evaluating the policy again.
Serialization, edit protection, cancellation and the single Undo/Redo
transaction keep the same contract.

Set `EditorOptions.portAnchorSnapPriority: 'midpoints-first'` to prefer a
midpoint when its zone overlaps a corner's. `PortAnchorSnapPriority` also
accepts `'corners-first'`, the existing default. Priority changes only the
order of these two target kinds; edges remain the final fallback. A
preferred kind must still have a permitted, enabled target within its
acquisition or retention band. Otherwise the other point kind is tried,
then edges, then free placement.

`PortAnchorSnapPriorityChanged` updates the editor preference while idle,
without graph/history changes. Invalid preference events are ignored.
The pure resolver accepts `priority`, as do `PortAnchorSnapOverrides`
and captured `PortAnchorSnapSettings`. A per-port override wins over the
editor preference; an omitted/undefined override inherits it. Omitted
priority remains implicitly corners-first for existing settings records.
Invalid initial, helper or resolver values throw `ZlozError`.

Priority is captured at drag start with the other settings, including
through bypass and stationary modifier changes. A target in the preferred
kind wins over a retained target in the lower kind. Hysteresis and routing
tie-breaks within each kind retain their existing rules. Bypass clears
retention and restores fresh acquisition in the captured order. Current
permission checks, cancellation, exact edits and one-step Undo/Redo are
unchanged. Guide enumeration retains canonical target order and includes
all permitted kinds; active feedback reflects the resolved winner and
custom renderers receive the captured priority. This preference is not a
serialized graph field.

Set `zlozView`'s `portAnchorGuides: true` to show permitted targets during
an anchor drag. Guides are off by default and include only target kinds
with positive acquisition radii and permitted names in the captured rules.
The default uses edge lines and point markers, highlighting the attracted
target. Markers and strokes retain their screen size at zoom. No radii or
measurements are printed.

Guides follow the existing `alignmentGuides` diagnostic flag. Minimal mode,
`diagnostics: false`, or `diagnostics: { alignmentGuides: false }` hides
them before custom rendering. They also disappear during bypass, after
release/cancellation, for read-only or protected ports, and when the node
is not in the visible canvas. Editing and snapping do not depend on guides.
The overlay is decorative, aria-hidden, inert and pointer-transparent.

`renderPortAnchorGuide(context, h)` replaces one guide with SVG in world
coordinates. Returning `undefined` uses the native guide; `null` omits it.
`ZlozPortAnchorGuideContext` includes the node/port, normalized `target`,
resolved world `start`/`end` (equal for points), `active`, `viewport` and
detached captured `settings`. Compose `zlozPortAnchorGuide(h, context,
attributes)` to customize paint while keeping native geometry, or supply
your own SVG using those coordinates. The package owns the inert overlay
and target identity wrappers. The renderer does not run the policy callback.

Headless consumers can use `portAnchorSnapGuideTargets(settings)` to enumerate
normalized `PortAnchorSnapGuide` values for their own presentation. The
helper validates settings and shares canonical corner/midpoint geometry
with the snap resolver. It reports permitted targets regardless of cursor
distance, without changing graph data, gestures or history.

Set `zlozView`'s `portAnchorKeyboardTargets: true` to enable plain Page Down
(next), Page Up (previous), Home (first), and End (last) on focused port
anchor handles. It defaults to off. Native handles expose shortcut metadata
and help; custom handle contexts receive `keyboardTargets`. Text fields,
disabled/read-only controls, modified keys and active pointer captures keep
their existing behavior. Held-key repeats are consumed without producing
repeated edits. Tab keeps its normal focus order. Arrows still nudge exactly
1%, or 10% with Shift, independently of target cycling.

`PortAnchorTargetStepped` is the headless editor fact, with an `endpoint`
and `step: 'next' | 'previous' | 'first' | 'last'`. Each idle action resolves
the current per-port settings and checks edit permission before selecting
from enabled, permitted corner and midpoint targets. Edges are continuous
and do not participate. Radii enable target kinds; keyboard selection can
reach a permitted point from any current position. Priority orders the
two point kinds, with canonical order within each: top-left, top-right,
bottom-left, bottom-right for corners; left, right, top, bottom for midpoints.

Next/previous wrap at the ends. From a position outside the target set,
next chooses the first and previous chooses the last. Home/End choose those
endpoints directly. Every different position is one Undo/Redo transaction,
preserving routing direction, port identity and wiring. Already-at-target
actions preserve the existing position representation and history. Empty
sets leave the document alone and report a named no-target notice. Protected
ports report their current reason; active gestures and read-only editors
ignore the action. The standard status region announces the selected target
even when diagnostic presentation is visually hidden. Keyboard actions are
atomic and do not create a pointer gesture or keep pointer guides open.

`resolvePortAnchorTargetStep(anchor, settings, step)` supports custom
controls. It returns `PortAnchorTargetStepResult`: either `{ type: 'empty' }`
or a detached `PortAnchorPointTarget`, zero-based `index`, and `count`.
The helper validates settings/actions without changing editor state. Hosts
can use the typed fact for their own buttons or bindings with the native
mapping off. Target names, list normalization and priority reuse the same
package rules as pointer snapping and guides.

Set `connectionDropRadius: 32` on the view to snap new connections within
32 CSS pixels of a rendered port center. The default is zero.
Set `reconnectionDropRadius` to give existing edge reconnections their
own radius. It inherits `connectionDropRadius` when omitted. Use `0`
to require an exact port hit. Both values must be finite and non-negative.
The preview and release use the first eligible nearby port in distance order.
An exact port hit takes priority and can show its normal rejection reason.
The distance stays constant in screen space as the canvas zooms.

Pass `connectionSnapHysteresis: 12` to `createEditor` to steady nearby
target selection for both new wires and reconnections. Use it with a
positive drop radius. The current eligible target stays selected until
another eligible port is closer by more than 12 CSS pixels. Leaving the
drop radius releases it immediately, and exact port hits take priority.
The margin defaults to zero and must be finite and non-negative.
Send `ConnectionSnapHysteresisChanged` with a `distance` while idle to
change it. This preference stays outside graph undo and saved documents.

Custom input adapters can include a finite, non-negative `distance` on
each `nearbyTargets` endpoint. Keep the array sorted by distance.
Endpoint-only messages retain their nearest-eligible behavior.

Pass `canConnectPort(endpoint, graph)` to both `updateEditor` and `zlozView`
to lock individual ports. Return a reason to block the port or `null` to allow
it. Locked outputs cannot start new wires, and locked inputs reject drops.
Existing edges stay visible. Reconnecting an edge checks the destination port
for the end being moved. Use `canReconnect` to lock the edge end itself and
`canConnect` for rules that depend on the proposed pair.

The view disables locked port buttons, including custom shells that use
`zlozPort`. Use `data-flow-port-locked` to style them. The reducer checks the
policy again before committing pointer, keyboard, and direct connection edits.

Pass the same `canReconnect` callback to `updateEditor` and `zlozView` to
lock specific edge ends. The callback receives the existing edge, the end
(`'source'` or `'target'`), and the full graph. Return a reason to lock the
end or `null` to allow an attempt. Locked handles are omitted. The reducer
checks again during a drag and before committing, including for direct
`EdgeReconnected` events from an inspector. Allowed targets still go
through port validation and `canConnect`.

```ts
const canReconnect: EditorPolicy['canReconnect'] = (edge, end) =>
  edge.id === 'approval' && end === 'source' ? 'Approval source is locked.' : null;
```

Hosts can offer the same edit through keyboard controls using `EdgeReconnected`.

A node with `kind: 'group'` draws a boundary. Set a node's `parentId` to a
group ID to make it a member. Groups can contain other groups. Positions
remain in canvas coordinates, including inside a group. Dragging or nudging a
group moves its descendants once, even when some are also selected. Deleting
a group deletes its descendants and their connections in one undo step.

Drag a node or group title into an expanded boundary to change its parent.
The deepest eligible group under the pointer highlights as the drop target.
Drop outside all eligible boundaries to move the selection to the canvas root.
Only the roots of the dragged selection change parent, so nested contents stay
together. Position and membership share one undo step. Escape cancels the drag.

Group membership is explicit. Layout engines can return an optional size on a
group position to fit the boundary to its children. The ELK adapter arranges
both flat and nested graphs.

`SelectionGrouped` wraps selected siblings in a new boundary sized to their
contents. `SelectionUngrouped` removes selected boundaries and promotes their
contents to the nearest remaining parent. Both preserve canvas positions and
connections and commit one undo step.

Shift-drag the canvas background to draw a selection box. Releasing selects
fully enclosed nodes and replaces the previous selection. If the box encloses
a group and its children, the group represents them in the selection. Escape
cancels without changing the prior selection. Box selection leaves the graph
and undo history intact.

Set `minimap: true` to show the diagram overview after the canvas is measured.
The rectangle shows the current viewport. Click the overview to center the
canvas on that point at the current zoom. This changes only the viewport.

Set `viewportControls: true` to show **Zoom in**, **Zoom out**, and **Fit view**
above the canvas. Zoom is centered on the visible canvas. The controls are
available in read-only views and work with standard button keyboard input.

Enable `snapToGrid` in editor options or send `GridSnapToggled` to toggle
a canvas grid (`gridSpacing`, default 20 units). While dragging, the grabbed node snaps to the grid and
the rest of the selection follows by the same offset, including group contents.
Group resize handles and width edits snap the moving boundary in canvas units,
including top/left boundaries and side handles. Size limits, content and parent
constraints, and locked proportions take precedence when a grid intersection
cannot satisfy them. Resizing preserves fixed children and its opposite anchor.
The setting is session state and each completed drag is one undo step.
Background appearance is configured separately and follows pan and zoom.

Copy, Paste, and Duplicate work from canvas focus with Ctrl/Cmd+C, V, and D.
Enable `snapToAlignment` or send `AlignmentSnapToggled` to align the dragged
selection's edges and centers with nearby visible nodes. Guides appear within
six screen pixels of a match at any zoom. Alignment takes priority on a matched
axis; grid snapping still applies on the other axis. Guides disappear on
release or cancellation. Set `--flow-alignment-guide` to theme their color.

Set `autoPan: true` on the FoldKit view to pan near the canvas boundary
during node moves, connection drags, and reconnections. The drag remains
anchored to the pointer as the viewport moves. Release or Escape stops the
pan. Viewport travel stays separate from graph undo.

Set `wheelNavigation` to choose how the canvas handles wheel and trackpad
scrolling:

| Mode     | Behavior                                                                  |
| -------- | ------------------------------------------------------------------------- |
| `'zoom'` | The default. Vertical wheel motion zooms around the cursor.               |
| `'pan'`  | Scroll pans in both axes. Hold Ctrl or Command to zoom around the cursor. |
| `'off'`  | Wheel events keep their native page or browser behavior.                  |

The option applies only to wheel input on the canvas. Editable controls
keep their own wheel behavior. Zloz updates its default help text to match
the option. Custom help receives the same `wheelNavigation` value.

Set `doubleClickZoom: true` to zoom in 1.25× around the pointer when
double-clicking the background. You can supply a finite multiplier
greater than 1 for a different step. The feature defaults to off and
works independently of wheel and pinch zoom. Box select, Zoom to area,
and interactive canvas items keep their own input behavior. Background
clicks still clear selection during normal navigation.

Set `spaceToPan: true` to pan temporarily with Space. Focus the canvas,
hold Space, then drag from the background. The drag preserves selection
and leaves Box select or Zoom to area available for the next drag.
Releasing Space during a drag lets it finish. Escape cancels the drag,
and focus loss clears the shortcut. Space continues to activate buttons
and enter text when those controls have focus. The feature defaults to off.

Set `middleButtonPan: true` to pan by middle-dragging the canvas background.
The gesture preserves selection and leaves Box select or Zoom to area
ready for a primary-button drag. Links and controls keep their native
middle-click behavior. This option defaults to off and is independent of
Space-drag and wheel navigation.

Pass `zoomLimits: { minZoom: 0.75, maxZoom: 1.3 }` and
`fitViewPadding: 96` to `createEditor` to customize the camera. Wheel,
pinch, double-click, toolbar, and Fit view share the inclusive range. Both limits must
be finite and positive, and equal limits fix the zoom. An explicit
`viewport` must be in range. Without one, Zloz starts at the allowed zoom
closest to 1.

Fit view uses CSS pixels for padding and caps the inset at a quarter of the
shorter canvas side. The defaults are 0.1–4× and 24 px. Dispatch
`ViewportConstraintsChanged` while idle to change both settings. If the
current zoom falls outside the new range, Zloz clamps around the canvas
center and stops any running fit. For host-controlled camera operations,
`zoomAt` and `fitViewport` take the same `ZoomLimits` as an optional fourth
argument.

Pass `fitViewDuration: 400` to `createEditor` to animate Fit view over
400 milliseconds. The default is zero for instant fitting. The FoldKit
view fits immediately when the browser prefers reduced motion. Panning,
zooming, or starting a canvas gesture takes over from the current camera
position. Dispatch `FitViewDurationChanged` to update the preference at
runtime. Camera movement stays outside graph history.

Set `pinchZoom: true` on the FoldKit view for two-finger touch navigation.
Move both fingers together to pan or change their distance to zoom around
the midpoint. A second touch cancels an active graph drag. Lifting a finger
ends navigation without starting another edit. Pinch and pan stay outside
graph undo and are available in read-only views.

Set `viewportControls: true` and `selectionModeControl: true` to show the
**Box select** toggle. While it is active, dragging the background draws a
selection box with touch or a mouse. Toggle it off to resume background pan.
Two-finger navigation and Shift-drag still work. The mode is editor session
state and can also be set initially with `selectionMode` or toggled by sending
`SelectionModeToggled`.

The editor's clipboard lives in session state. Copy includes selected groups,
their descendants, and connections with both endpoints in the selection.
Pasted nodes get new IDs, retain their internal hierarchy, and are offset
from the originals. If a copied node's parent was outside the selection,
its copy becomes a top-level node. Paste and Duplicate are single undo steps.

Set `contextActions: true` on the FoldKit view to open actions with a
right-click on a node or edge. Use Shift+F10 or the context menu key on a
focused node title or connection. Nodes offer Duplicate and Delete, and edges
offer Delete. Escape dismisses the panel.

The same option adds More actions buttons on nodes and beside entries in
the Connections list for touch and keyboard access.

Set a child's `extent: 'parent'` to constrain pointer drags and keyboard nudges
to its parent's authored bounds. The child keeps its parent on drag-out.
A selection moves by one common clamped offset. Moving the parent still moves
its descendants. Nodes larger than the parent are held on the oversized axis.
Sizing and content measurement are independent of this movement constraint.
The optional field is preserved by graph export and import.

Set a child's `expandParent: true` to grow its parent when an authored width
change or measured content height exceeds the group bounds. Growth adds
16 units of padding on overflowing sides and preserves canvas positions.
Enable expansion on an inner group to propagate growth to its own parent.
Pointer resizing and parent growth share one undo step. Smaller content
keeps the group's grown bounds.

Send `GroupFitClicked` with a group ID to fit its authored boundary to all
descendants. The group context panel exposes **Fit group to contents**.
Fitting preserves child positions, reserves header space and padding, and
commits one undo step. Empty groups keep their bounds. A constrained group
requires enough space in its parent or enabled parent expansion.

### Per-node resize limits

Set optional `resizeLimits` on a node to customize manual resizing in graph units:

```ts
resizeLimits: { minWidth: 180, maxWidth: 520, minHeight: 120, maxHeight: 400 }
```

Each supplied limit must be finite and positive; a minimum cannot exceed its
maximum. Partial limits are supported and survive save/load, clipboard and Undo.
Cards apply width limits to pointer handles and `NodeWidthChanged`; card height
continues to follow content. Groups apply both axes through pointer handles,
`GroupResizeNudged` and width edits. When proportions are unlocked, only edited axes change. Group contents and
parent containment can prevent a resize when there is no valid size. Existing
nodes may start outside their limits; their next manual edit clamps the edited
axis. Layout, Fit group to contents, measurements and ancestor expansion remain
independent of manual resize limits. Omitting the field preserves default ranges.

### Lock group proportions

Set `keepAspectRatio: true` on a group, or dispatch `GroupAspectRatioToggled` with
its `id`. The package context panel offers **Lock proportions**; the sample also
shows it beside Fit group to contents. The toggle is saved, copied and undoable.
Cards cannot declare this field because their height follows content.

Manual pointer, keyboard and width edits then scale both dimensions together
from the group's current proportions, keeping children fixed. Corner handles anchor
the opposite corner; side handles anchor the opposite edge and preserve the
perpendicular center. Corner resizing follows the larger proportional axis change. The
scale is bounded by both dimensions' resize limits, contents and parent extent;
conflicting bounds leave the graph unchanged. Escape cancels a pointer drag,
and releasing commits once. Repeated edits at a bound do not add Undo entries.
Layout and explicit fitting can establish new proportions for the next resize.

Pointer `NodeResizeStarted` and keyboard `GroupResizeNudged` accept an optional
`handle`: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'`.
The existing `corner` field remains supported; `handle` takes precedence when both
are supplied. Omitting both preserves bottom-right behavior. `delta` follows the moving handle's canvas
direction: moving a left handle right shrinks width; moving a top handle down
shrinks height. Pointer positions remain surface CSS pixels, with zoom handled
by the reducer. Top handles reserve 48 units above contents for the group header;
other moving boundaries reserve 24. Existing tighter bounds are preserved.

Side handles ignore perpendicular pointer movement and keyboard arrows. With
proportions locked, the dragged axis drives both dimensions and the perpendicular
center stays fixed. Limits, content padding and parent bounds apply to the full
result, including the centered dimension. A conflicting intersection is a no-op.

### Background grids

`zlozView` defaults to dots even when snapping is off. Built-in backgrounds accept
positive finite `gap` (graph units) and `size` (dot radius or square line width),
plus a CSS `color`. An omitted gap follows `editor.gridSpacing` (default 20);
size defaults to 1. An explicit visual gap overrides spacing only for that backdrop. Use `{ type: 'none' }` for a plain canvas.

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  background: { type: 'squares', gap: 20, size: 1, color: 'var(--grid-color)' },
});
```

For a custom layout, use `{ type: 'custom', render }`. The callback receives
`{ id, viewport, surface, spacing }` and the host's typed `HtmlBuilder`. `surface`
can be `null` before measurement. Return ordinary FoldKit HTML/SVG; keep it
decorative. Zloz places it behind the graph in a non-interactive, aria-hidden
screen-space layer. Apply the supplied viewport when drawing canvas-space grids.
No browser mutation, effects, or second UI runtime is needed.

```ts
background: {
  type: 'custom',
  render: ({ viewport, spacing }, builder) => builder.div([
    builder.Style({
      position: 'absolute', inset: '0',
      'background-image': 'radial-gradient(circle, #64748b 1px, transparent 1px)',
      'background-size': `${spacing * viewport.zoom}px ${spacing * viewport.zoom}px`,
      'background-position': `${viewport.x - spacing * viewport.zoom / 2}px ${viewport.y - spacing * viewport.zoom / 2}px`,
    }),
  ], []),
}
```

`ZlozBackground<Message>` and `ZlozBackgroundRenderContext` are exported from
`@opsydyn/foldkit-zloz/foldkit`. Background selection belongs to the host Model;
it never changes the graph or Undo history. The sample demonstrates dots,
squares, a composed custom graph-paper renderer, and no grid.

### Shared grid spacing

Initialize `createEditor(graph, { gridSpacing: 32, snapToGrid: true })`, or dispatch
`{ type: 'GridSpacingChanged', spacing: 32 }`. Spacing must be finite and positive;
fractional units are supported. Invalid initialization throws; invalid, redundant,
read-only or active-gesture changes are ignored. Changing spacing does not move
nodes, change revision or add an Undo step. Undo/Redo retain the current preference.

Node drag snapping, group boundary snapping, resize keyboard steps, default dots
and squares, and custom renderer `context.spacing` share the setting. Resize keys
move one interval, or four with Shift, while snapping is enabled. Duplicate/paste
placement offsets use two grid intervals. Explicit background `gap` remains an
independent visual override. Grid spacing is editor session state, excluded from
graph JSON; hosts can persist preferences separately. The sample retains it when
switching examples and loading/importing diagrams.

### Resize alignment guides

Enable `snapToAlignment` (the sample's **Snap to nodes**) for magnetic group
resizing. Pointer drags align moving edges to nearby visible card edges and
collapsed group edges within six screen pixels. Expanded boundaries and the
resized group's descendants are excluded. Corner handles can align both axes;
side handles align their moving axis. Keyboard sizing keeps its existing steps.

Alignment overrides the grid only on a matching axis. With locked proportions,
the closest matched edge drives uniform scaling. Content, parent and size limits
remain authoritative: a guide is shown only if the resulting edge reaches its
target. Guides live in the resize gesture, clear when leaving the target, and
vanish on release or Escape. A completed resize remains one Undo step. The
FoldKit renderer draws them using the existing `--flow-alignment-guide` token.

Use `renderAlignmentGuide(context, h)` to replace the decorative SVG for
either drag or resize guides. The context provides the resolved guide,
`start` and `end` in graph coordinates, the gesture phase, and the viewport.
Use the supplied endpoints so the decoration follows the snap result.

```ts
renderAlignmentGuide: ({ start, end }, h) =>
  h.line([
    h.X1(String(start.x)), h.Y1(String(start.y)),
    h.X2(String(end.x)), h.Y2(String(end.y)),
    h.Stroke('#0f766e'), h.StrokeWidth('2'),
    h.Style({ 'vector-effect': 'non-scaling-stroke' }),
  ], []),
```

Return `undefined` for the default dashed guide or `null` to omit it.
Zloz calls the hook only for resolved guides when the effective
`alignmentGuides` diagnostic is enabled. Guide visibility is independent
of snapping.

### Lock node movement

Pass `canMoveNode(node, graph)` in `EditorPolicy` to allow or block dragging
and keyboard nudging. Return `null` to allow a node to move, or a reason to
block it. A move checks the entire selection, including descendants of groups.
One locked node blocks the whole move. A drag uses the graph as it was at the
start of the gesture and checks the policy again before committing. Pass the
same callback to `zlozView` to expose the lock on node handles. Custom shells
receive `moveDisabledReason` and can still use `zlozDragHandle` for selection.

### Lock node dimensions

Pass `canResizeNode(node, graph)` in `EditorPolicy` to restrict explicit
resizing. Return a reason to block an edit or `null` to allow it. The policy
covers pointer resizing, keyboard resize steps, direct dimension edits, and
Fit group to contents. If an edit would also grow an ancestor with locked
dimensions, Zloz rejects the whole edit.

Pass the same callback to `zlozView` to hide locked resize handles and
disable group dimension controls. Custom node shells receive
`resizeDisabledReason`. Movement permissions apply separately.

### Control which items can be selected

Pass `canSelectNode(node, graph)` or `canSelectEdge(edge, graph)` in
`EditorPolicy`. Return `null` to allow selection or a reason to exclude
the item. Zloz checks direct selection and interactions that select an item,
such as opening its context menu. An excluded group can still contain
individually selectable nodes.

Pass the same callbacks to `zlozView` so selection controls and the marquee
preview agree with the reducer. Excluded items remain visible. Custom node
shells, connection rows, and edge labels receive `selectionDisabledReason`.
These callbacks govern new selection attempts. To clear a selection after
changing the policy, send `SelectionCleared`.

### Fit the selection

Set `fitSelectionControl: true` with `viewportControls: true` to show
**Fit selection**. Custom viewport controls can render
`context.actions.fitSelection` with `zlozViewportControl`. The action
emits `{ type: 'FitSelectionClicked' }`.

Fit selection frames selected visible nodes and connections together.
For edges, it uses the displayed endpoint bounds and any stored route
used by the built-in path. A collapsed endpoint uses its group boundary.
The camera follows the configured padding, zoom limits, and Fit view
animation, including reduced motion. Selection and undo history are
preserved. Custom SVG geometry can extend outside the fitted bounds.

### Zoom to an area

Set `zoomAreaControl: true` with `viewportControls: true` to show **Zoom to
area**. Custom viewport controls can use `context.actions.zoomArea` with
`zlozViewportControl`. The action emits `ZoomAreaModeToggled`. The next
background drag fits its rectangle and returns to the previous canvas mode.
Each side must span at least 5 CSS pixels. Escape on the canvas or the
pressed control cancels.

The fit uses the configured padding, zoom limits, animation, and reduced
motion behavior. It works in read-only views and preserves selection and
undo history. Use `renderZoomAreaMarquee(context, h)` to paint the preview
inside Zloz's pointer-inert frame. The context provides normalized world
bounds and the viewport. Return `undefined` for the default or `null` to
hide the decoration.

### Back to previous view

Set `previousViewControl: true` with `viewportControls: true` to show
**Back to previous view**. Custom controls can use
`context.actions.previousView` with `zlozViewportControl`, or send
`{ type: 'PreviousViewClicked' }` directly.

Zloz keeps one session checkpoint. Fit view, Fit selection, Zoom to area,
and node or connection reveal capture the camera before moving it.
Manual pan and zoom leave the checkpoint available. Back uses it once,
respects the current zoom limits and reduced-motion preference, and works
in read-only views. It preserves the current selection, group expansion,
graph, and undo history. Snapshots save the current camera only.

### Reveal a node

Send `{ type: 'NodeRevealRequested', id }` to center a node. Zloz keeps the
current zoom when the node fits and zooms out as needed within the active
limits. It expands collapsed ancestors and uses the existing Fit view timing,
including reduced motion. Graph edits, selection, and history are separate
from this camera action.

Use `revealableNodes(state)` to populate a search or navigation control.
It includes nodes inside collapsed groups and filters explicitly hidden
nodes and descendants. Reveal requires a measured canvas and an idle
gesture, and works in read-only mode.

### Reveal a connection

Send `{ type: 'EdgeRevealRequested', id }` to frame both endpoint nodes
and the stored route when the edge uses it. Zloz opens collapsed ancestors
of the endpoints, preserves selection and history, and uses the same zoom
and timing rules as node reveal. The frame uses authored endpoint bounds and
stored route points. Custom SVG path extensions can extend beyond that frame.

Use `revealableEdges(state)` for connection search. It includes edges inside
collapsed groups and excludes explicitly hidden edges or edges with hidden
endpoints.

### Save the camera with the graph

Call `serializeSnapshot({ graph, viewport })` to include pan and zoom in a
version 1 document. `parseSnapshot(text)` validates the graph and any camera
it contains. For graph-only documents, the returned snapshot omits
`viewport`. `serializeGraph` and `parseGraph` continue to read and write the
graph on its own.

```ts
const saved = serializeSnapshot(editor);
const { graph, viewport } = parseSnapshot(saved);
const reopened = createEditor(graph, viewport ? { viewport } : {});
```

Snapshots include the authored graph and optional camera. Selection, undo
history, routes, and active gestures are session state. The viewport must
have finite pan coordinates and a positive finite zoom. Hosts using custom
zoom limits can bound the saved zoom before initializing the editor.

### Retain built-in node views during camera and chooser updates

Pass one FoldKit `createLazy()` slot per canvas as `nodeViewCache`.
Keep `onEvent` and any `renderNode` callback stable to reuse the node and
port layer across camera-only renders. With viewport culling enabled, the
layer is reused while the mounted node set stays the same. Entering or leaving
the overscan area rebuilds the layer from the current graph. The slot holds
one layer per canvas. Graph edits, selection changes, and changes to the
other layer inputs also rebuild it. Pending connection creation is eligible:
the staged source is a layer input, so source changes, cancellation and creation
refresh native port feedback while unrelated chooser filtering can reuse the layer.
Read-only changes also rebuild the layer. With culling, a staged source remains
pinned until cancellation or creation changes the mounted set.

Whole-layer retention falls back to live views for custom node shells, node policies,
node filtering through visibility or group collapse, open context panels,
custom ports and editing gestures. Port policies stay live so changing
protection reasons remain current. The retained context trigger resolves its
anchor against the latest viewport when activated.

### Retain bodies while ports stay live

For policy-controlled or custom ports, supply a separate per-canvas body cache:

```ts
import { createLazy } from 'foldkit/html';
import { createZlozNodeBodyCache, zlozView } from '@opsydyn/foldkit-zloz/foldkit';

const nodeViewCache = createLazy();
const nodeBodyCache = createZlozNodeBodyCache();

// Inside the host view; keep these cache instances stable for this canvas.
zlozView(h, editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent,
  nodeViewCache,
  nodeBodyCache,
  canConnectPort: policy.canConnectPort,
});
```

`nodeBodyCache` also works independently. When both are supplied, the whole-layer
slot is preferred where eligible; otherwise the built-in frame and ports render
live around retained bodies. Port callbacks and custom `renderPort` hooks run on
every view. Native disabled states, protection reasons and pending-source feedback
therefore follow the current Model without becoming cache permissions.

The body contains the title/drag handle, context/resize controls and `renderNode`
content. A layout-transparent wrapper preserves control order and leaves ports
as direct frame children. That wrapper stays consistent across cache/fallback
transitions while the body option is present, preserving focused body controls.
Bodies track node identity, selection, read-only state and their rendering inputs,
not the pending source or a graph snapshot. Keep `onEvent` and content callbacks
stable; replace a callback when its captured display inputs change.

The factory uses weak immutable node identities rather than retaining a permanent
map of editor IDs. Use one instance per canvas; never share a slot between two
simultaneously mounted canvases. Replacing a node object rebuilds that body.
Custom shells, node-body policies, open context panels, visibility/group filtering
and editing gestures keep their live path. This is view memoization only; graph
edits, current permission checks, measurements and Undo remain Model-owned.

### Compose the cache inside a custom shell

Custom shells can call the same public cache explicitly. The workbench Orbit
node caches its SVG/label using `[h, node, selected, selectionPreview]`; the Orbit
group caches only its label using `[h, node]`. Handles, resize/collapse buttons,
frames and sockets stay live. Do not pass the complete context, graph or a port
policy into an artwork-only key.

```ts
const shellCache = createZlozNodeBodyCache(); // one cache per canvas/body position

// Inside a custom shell; drawArtwork accepts exactly these immutable inputs.
const artwork = shellCache(context.node, drawArtwork, [
  h,
  context.node,
  selected,
  context.selectionPreview,
]);
return zlozNodeFrame(
  h,
  context,
  [],
  [
    zlozDragHandle(h, context, [], [artwork]),
    ...context.resizeHandles,
    ...(context.ports ??
      context.node.ports.map((port) =>
        zlozPort(h, context, port, [], [port.kind === 'output' ? '→' : '←']),
      )),
  ],
);
```

Use the same artwork constructor and root shape with caching on or off so an
optional optimization does not replace live controls. Include every value the
artwork actually reads in its arguments. The automatic `nodeBodyCache` option
still falls back for complete custom shells; this is explicit composition using
public frames, controls and cache functions, without private input attributes or
an alternate permission path. See the
[Orbit composition evidence](../../apps/zloz-demo/evidence/orbit-body-cache.md).

### Cull canvas items outside the viewport

Set `viewportCulling: true` on `zlozView` to mount canvas items near the
measured viewport. The default is off. Use `{ overscan: 96 }` to customize the
buffer in CSS pixels. Before the surface is measured, the whole canvas renders.

Focused and selected items stay mounted, along with active gesture items.
Built-in edge bounds include crossing edges and routes. Authored edge labels
and edges with custom geometry or drawing hooks stay mounted so their content
can extend beyond the default bounds. Custom node shells can choose more
overscan for content that extends outside their node frame. Offscreen shells
can remount as the camera moves, so keep their durable state in the Model.
The tab order includes mounted canvas controls.

Fit view, the minimap, the Connections list, world overlay inputs, and graph
operations still use the full visible graph.

### Hide nodes and edges

Use `createEditor(graph, { visibility })` for initial visibility and send
`VisibilityChanged` to replace it during the session. Omit either list to
show those items again.

```ts
const next = updateEditor(state, {
  type: 'VisibilityChanged',
  visibility: { hiddenNodeIds: ['review'], hiddenEdgeIds: ['optional-link'] },
});
```

Hiding a node hides its incident edges. Hiding a group also hides its
descendants. Collapsed groups still project edges between visible boundaries.
The canvas, minimap, Connections list, Fit view, and marquee use the same
visible items. Changing visibility clears hidden selections and cancels
in-progress gestures. The underlying graph, exports, and Undo history retain
the authored items. Use editor policies to restrict edits to graph data.

### Protect nodes and edges from deletion

Pass a pure `canDelete` callback in `EditorPolicy` to `updateEditor`. It
receives the nodes and edges that would be removed, including selected
groups' descendants and incident edges, and the original graph. Return a
reason to reject the entire deletion or `null` to accept it. A rejection
sets the editor notice and preserves the graph, revision, and Undo/Redo
history. Accepted deletions use the existing transaction boundary.

```ts
const canDelete: NonNullable<EditorPolicy['canDelete']> = ({ nodes, edges }) =>
  nodes.some((node) => node.id === 'required-step') ||
  edges.some((edge) => edge.id === 'required-link')
    ? 'This workflow step or connection is required.'
    : null;

const next = updateEditor(state, event, { canDelete });
const view = zlozView(h, next, { id: 'workflow', label: 'Workflow', onEvent, canDelete });
```

Pass the same callback to `zlozView` for disabled Delete actions and their
reason in the built-in context panels and edge toolbar. Custom controls can
read `disabledReason` from the action descriptors or call `resolveDeletion`
with their own targets. The policy may run during rendering and again when
the editor handles a deletion, so keep it synchronous and pure. The host
decides how to identify required items.

### Box selection matching

Full containment is the default. To include cards that overlap only part of
the marquee, initialize the editor with `boxSelectionMatch: 'partial'` or
send `{ type: 'BoxSelectionMatchChanged', match: 'partial' }` while idle.
The setting applies to both Shift-drag and Box select. It belongs to the
editor session and is separate from the saved graph and Undo history.

Partial matching requires positive-area overlap. Touching an edge or
drawing a zero-area rectangle selects no items by overlap. Expanded group
frames still require full containment, so a marquee inside a group can
select its children independently. Collapsed groups match using their
visible bounds, and hidden descendants stay excluded. Selection is applied
on release.

### Live box-selection preview

While drawing a marquee, Zloz highlights the nodes that would be selected
on release. The preview uses the same match rule, collapsed-group
projection, and ancestor selection as the final selection. Pressed states
and selection actions continue to reflect the committed selection until
release. Escape clears the preview and keeps the prior selection.

Custom node and group shells receive `selectionPreview` for their own
highlight styling. Set `selectionPreviewHighlights: false` to disable node
highlights. The marquee hook still receives `previewNodeIds` so a host can
show its own feedback. Preview remains available in minimal mode.

### Custom box-selection marquee

Use `renderSelectionMarquee(context, h)` to replace the decoration during
a box-selection gesture. The context contains normalized `bounds` in graph
coordinates, the current `viewport`, the matching rule, and `previewNodeIds`. Zloz positions and sizes the frame
using the same bounds as selection on release. Use decorative content that
fills the frame.

```ts
renderSelectionMarquee: (_, h) =>
  h.div([h.Style({
    position: 'absolute',
    inset: '0',
    border: '2px dashed #0f766e',
    background: 'rgb(20 184 166 / 0.15)',
  })], []),
```

Return `undefined` for the default outline or `null` to omit the decoration.
The frame ignores pointer input and stays available during selection in
minimal mode.

### Live resize dimensions

The FoldKit view shows a width × height readout in the canvas's lower-left corner
during pointer resizing. With `resizeHandles: true`, it also stays visible for a
single selected, expanded group so keyboard resizing has the same feedback.
Card readouts are transient. Read-only views and collapsed/hidden groups omit it.
Set `resizeReadout: false` to disable the readout. To replace its appearance,
use `renderResizeReadout(context, h)` with the host's typed FoldKit builder.

```ts
renderResizeReadout: ({ node, widthText, heightText }, h) =>
  h.div([h.Class('dimensions')], [
    node.label + ' · Width ' + widthText + ' · Height ' + heightText,
  ]),
```

The renderer receives the node with raw Model dimensions, the formatted
values, and the `resizing` or `selected-group` phase. Zloz keeps placement
and the polite status region. Return `undefined` for the default badge or
`null` to omit an eligible readout. The renderer runs only when the effective
`measurements` diagnostic and the readout option allow it.

Values come from the current Model in graph units, including snapping, limits,
locked proportions and measured card height. Up to two decimal places are shown;
this never rounds authored geometry. The badge stays the same screen size while
zooming, ignores pointer input, and uses a native polite status region. Releasing
keeps a selected group's result visible; Escape restores its original dimensions.
Selection clearing hides it. Theme it with `--flow-resize-readout-background` and
`--flow-resize-readout-color`, alongside existing node border/color tokens.

### Numeric group dimensions

With `contextActions: true`, open a group's **More actions** panel to edit Width
and Height in graph units. Each field applies on native change (for example,
leaving the field), creating one Undo step. The panel stays open for sequential
edits and displays the resulting dimensions after grid snapping, size/content
limits, parent containment or expansion, and locked proportions. Controls are
disabled for collapsed groups and unavailable in read-only views. Escape closes
the panel; changes already applied remain undoable.

Hosts can dispatch `{ type: 'GroupDimensionChanged', id, dimension: 'height',
value: 320 }` (or `dimension: 'width'`). Numeric edits anchor the group's top-left
corner and keep child positions fixed. With proportions locked, changing either
dimension also scales the other. Invalid/non-positive values and active-gesture
edits are ignored; repeated clamped values add no history. `NodeWidthChanged`
continues to support group width through the same geometry path. The fields trim
floating-point display noise without rounding authored geometry.

### Custom canvas help and status

Use `renderCanvasHelp` for instructions and `renderCanvasStatus` for notices
or a diagram summary. Both receive `defaultText` and the effective
`visible` flag. Help also includes the selection mode, toolbar availability,
and read-only state. Status includes the current notice and visible node
and connection counts.

```ts
renderCanvasHelp: ({ defaultText }, h) =>
  h.div([h.Class('canvas-help-card')], [
    h.strong([], ['Canvas controls']),
    h.p([], [defaultText]),
  ]),
renderCanvasStatus: ({ defaultText }, h) =>
  h.span([h.Class('canvas-status-badge')], [defaultText]),
```

Zloz keeps the description ID referenced by the canvas and node controls,
and updates status inside the existing polite live region. Diagnostics
visually hide these containers while preserving their accessible content.
Keep meaningful text in both renderers, including when `visible` is false.
Return `undefined` to use the default copy.

### Diagnostics and minimal mode

Use `minimalMode: true` for a clean package view, or `diagnostics: false` to
suppress all diagnostic presentation. Both override individual flags. Defaults
preserve existing presentation. Configure individual diagnostics with:

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  minimalMode: model.minimalMode,
  diagnostics: {
    measurements: false, // size readout, numeric group inputs and numeric resize tips
    alignmentGuides: false, // visual lines; snapping remains active
    zoomLevel: false, // percentage; zoom controls remain usable
    status: false, // visually hide notices/counts, retain polite announcements
    instructions: false, // visually hide help, retain accessible descriptions
    overview: false, // hide an enabled minimap
    connectionList: false, // replace the verbose list with a compact Connections disclosure
  },
});
```

Connection actions remain keyboard-accessible through the compact disclosure.
Its `ConnectionListToggled` fact updates editor session state without changing
graph geometry, revision or Undo history; it also works in read-only views.
Opening it is an explicit inspection action. Full lists keep their existing
presentation. Graph labels, ports, selection/resize handles, background styles
and editing controls are not diagnostics and retain their own options.

`resolveZlozDiagnostics(options)` and the `ZlozDiagnostics` /
`ZlozDiagnosticOptions` types are exported from `/foldkit`. Use the resolver in
custom node renderers or host chrome to apply the same effective flags; the
package cannot identify diagnostics in arbitrary consumer content. The existing
`resizeReadout: false` option still independently hides just the size badge.
These are view preferences, not graph document fields. Minimal mode never turns
off snapping, constraints or other editing behavior. The workbench demonstrates
global and individual toggles, retains stored flag choices, and hides its own
inline controls without changing node footprints.

### Design freedom and public composition

With `viewportControls: true`, supply `renderViewportControls` to lay out or
omit any action. The context contains `actions`, `diagnostics`,
`selectionModeControl`, and the current `state`. Use `zlozViewportControl` for
native button semantics, or map an action's `event`, `disabled`, and `pressed`
fields into your own component. The action `label` supplies the accessible name
and can be translated or changed to match your visible text.

```ts
renderViewportControls: ({ actions }, h) =>
  h.nav([h.AriaLabel('Diagram navigation')], [
    zlozViewportControl(h, { ...actions.fitView, label: 'Frame graph' }, onEvent,
      [h.Class('frame-action')], ['Frame graph']),
  ]),
```

With `minimap: true`, `renderMinimap` receives visible nodes in paint order and
world bounds from the current Model, including collapsed groups. Compose
`zlozMinimap(h, context, onEvent, frameAttributes, svgChildren)` inside the Zloz
surface for pointer input. Its inner SVG stretches to fit the frame and maps
clicks using the area inside the border and padding. Draw node marks in world
coordinates, and add `zlozMinimapViewport(h, context.geometry, svgAttributes)`
when you want a camera outline. You can also draw your own outline from
`geometry.visible`, or leave it out. Arrow keys pan the camera (Shift takes
larger steps), Home fits, and Enter or Space centers the overview.

Return `undefined` from either hook to use the shipped design. Existing feature
flags still control whether hooks are called. Minimal mode and the `overview`
diagnostic hide the minimap, while zoom and fit remain available. Navigation
works in read-only mode and leaves graph history unchanged.

### Design freedom and public composition

Freedom and control apply to the engineering API as well as end-user preferences.
The target is supported composition of complete presentation parts, with stable
interaction primitives and a headless behavior core. Consumers should not need
private DOM bindings, package forks or CSS specificity overrides to implement a
design. Presentation and geometry responsibilities must remain explicit.

The optional `/foldkit` entry now exposes `renderNodeShell(context, h)` and
`renderGroupShell(context, h)` alongside the existing content-only `renderNode`.
Return `undefined` from a shell hook to use the default for that node. A full shell
owns its contents; the content-only callback is used only by the default card.

```ts
import {
  zlozView,
  zlozNodeFrame,
  zlozGroupFrame,
  zlozDragHandle,
  zlozPort,
} from '@opsydyn/foldkit-zloz/foldkit';

zlozView(h, model.editor, {
  id: 'diagram',
  label: 'Architecture',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  renderNodeShell: (context, builder) =>
    zlozNodeFrame(
      builder,
      context,
      [builder.Class('my-node'), builder.Style({ padding: '16px', background: '#fff' })],
      [
        zlozDragHandle(builder, context, [], [context.node.label]),
        ...context.node.ports.map((port) =>
          zlozPort(builder, context, port, [builder.Class('my-port')], ['●']),
        ),
        ...context.resizeHandles,
      ],
    ),
  renderGroupShell: (context, builder) =>
    zlozGroupFrame(
      builder,
      context,
      [builder.Class('my-boundary')],
      [
        zlozDragHandle(builder, context, [], [context.node.label]),
        ...(context.collapseToggle ? [context.collapseToggle] : []),
        ...context.resizeHandles,
      ],
    ),
});
```

Use your host's normal event wrapper for `onEvent`. Every primitive accepts the
host builder, Model-derived context, normal builder attributes and children.
There are no default visual styles in the primitives. Classes and `h.Style` can
own borders, shape, typography, padding, icons and colors directly. The bundled
cards/groups use these same primitives.

- `zlozNodeFrame`: one measured HTML frame per ordinary node. Model owns its
  position and width; content controls height, reported through `NodeMeasured`.
- `zlozGroupFrame`: one boundary per group, with both dimensions from Model.
  Empty boundary space passes pointer events through to its descendants.
- `zlozDragHandle`: a native button carrying selection, movement, focus and drag
  behavior, with its node name and help description.
- `zlozPort`: a native connection button, centered on the Model's authored anchor
  independent of its visual size. Keep ports as direct children of the frame.
- `zlozResizeHandle(builder, context, handle, attributes, children)`: a native
  resize button. Groups support eight directions; ordinary nodes use width-only
  resizing (`right`). Arrow keys resize groups; Left/Right resize ordinary nodes.
  Shift increases the step. Grid snapping, limits, read-only policy and Undo use
  the same core path as the bundled view.

The context includes `node`, `state`, resolved `diagnostics`, `collapsed` and
`dropTarget`. It also supplies optional `contextAction`, `collapseToggle` and
`resizeHandles` from enabled default controls. Place or omit them freely, or use
native host controls with public editor events. Omit nested interactive controls
inside drag buttons. Consumers never need to copy private input attributes.

**Geometry contract:** frame position, width, group height, box sizing and input
markers belong to the primitives. Port position and transform belong to its Model
anchor. The primitives merge style attributes and apply those geometry properties
last. Keep frames at the supplied world coordinate level; avoid CSS transforms,
margins, size constraints or ancestor positioning that would move/scale the frame
away from Model geometry. Visual node height may intentionally change with
content or a shell switch; Zloz remeasures it and rebases history. Fixed group
bounds do not auto-fit to new content; use `GroupFitClicked` when desired.

The sample's **Node design** selector switches between the default cards and
complete circular SVG shells, including different group chrome, ports and resize
controls. Both use the same graph and package input lifecycle. The SVG artwork is
inside a measured HTML frame; native buttons retain keyboard behavior.

`renderEdge` decorates the shared resolved path; the geometry policy below
changes that path and its label anchor together. Follow-on boundaries are recorded in
[ADR 0004](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/adr/0004-composable-flow-presentation.md).

### Shared custom edge geometry

Use `ZlozEdgeGeometryPolicy` and `resolveEdgeGeometry` from the dependency-free
root entry, or pass a policy as `zlozView`'s `edgeGeometry` option. The optional
FoldKit entry also re-exports the policy/context/result types.

```ts
import type { ZlozEdgeGeometryPolicy } from '@opsydyn/foldkit-zloz';

const raisedArc: ZlozEdgeGeometryPolicy = ({ source, target, edge, route }) => {
  // Preserve authored styles and layout routing in this example.
  if (edge.pathStyle !== undefined || route) return undefined;
  const control = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 100 };
  return {
    path: `M${source.x},${source.y} Q${control.x},${control.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 2 * control.x + target.x) / 4,
      y: (source.y + 2 * control.y + target.y) / 4,
    },
  };
};

// Include these options alongside your normal id, label and onEvent options:
// edgeGeometry: raisedArc,
// edgeAppearance: (edge) => ({ hitWidth: 18 }),
```

The policy context contains `graph`, `edge`, `source`, `target`, `route`,
`sourceGroup`, `targetGroup` and `defaultGeometry`. Coordinates are world units.
Endpoints already account for collapsed groups. The default geometry already
resolves authored path styles and layout routing. An accepted custom result takes
precedence; returning `undefined` preserves the default. A pure headless consumer
uses `resolveEdgeGeometry(graph, edge, { policy, route, sourceGroup, targetGroup })`.
The original `edgePath` helper continues to return built-in geometry.

One resolved `path` feeds SVG decoration and selection. Its `labelPosition` feeds
on-canvas labels, label editing and toolbar placement. Set `labelPosition` to
`undefined` to omit those anchored parts. Connection-list selection and actions
remain available. `renderEdge` receives this same resolved path/anchor and remains
a decorative callback. Draw along `context.path` to retain interaction agreement.

The public `zlozEdgeHitTarget(builder, { edge, path, hitWidth }, attributes?)`
primitive encapsulates SVG selection bindings for composed presentations.
`zlozView` uses it for both default and custom decoration, with a transparent
12-unit selection corridor. `edgeAppearance.hitWidth` controls that width per
edge. It must be positive and finite. Native connection-list controls continue
to provide keyboard selection; reconnection handles stay anchored to ports.

Policies must be pure, keep their path endpoints at the supplied canonical
anchors, and choose their label anchor deliberately. The package rejects empty
paths and non-finite label coordinates with `ZlozError`; it does not validate SVG
syntax or infer label positions by reading the DOM. Keep path geometry out of CSS
transforms/overrides and out of `renderEdge` if it differs from the resolved path.
No policy functions are stored in Model or serialized documents.

The sample's **Edge design** selector demonstrates raised arcs in both node
presentations. Obstacle avoidance and custom-route bounds for Fit view remain
outside this contract. Connection-drag previews use the contract below.

## Generated API reference

```sh
bun run --filter @opsydyn/foldkit-zloz docs
# Open packages/foldkit-zloz/docs/index.html through a local static server.
```

The TypeDoc reference covers the public core and FoldKit entry points, optional
ELK and force adapters, and the lightweight force eligibility subpath. Signatures,
fields, unions and source links come from TypeScript exports. Its landing page
explains Model ownership, composition and package boundaries.

The Pages workflow builds the [Zloz API reference](https://opsydyn.github.io/fold-kit-experiments/zloz/api/).
That route becomes available when the updated workflow reaches Pages; generating
it locally does not publish the site or npm packages.

### Connection-drag previews

`resolveConnectionPreview(state, geometryPolicy?)` is a pure core helper. It
returns no preview for idle state, keyboard-only port selection or read-only
views. An active preview contains logical output-to-input `source`/`target`
points in world units, the actual world `pointer`, nullable endpoint identities,
`movingEnd`, projected `sourceGroup`/`targetGroup`, and the existing `edge` when
reconnecting. New incomplete connections have no synthetic edge or fake port ID.

`ZlozConnectionFeedback` is a union: `free`, `valid` with an accepted endpoint,
or `invalid` with a rejected endpoint and reason. Feedback comes from the same
core validation used on drop, including direction, duplicate and host-policy
checks. `Gesture.target` remains the accepted endpoint or null. Its optional
`rejected` details are mutually exclusive with an accepted target.

The view exposes two independent hooks:

```ts
import type {
  ZlozConnectionGeometryPolicy,
  ZlozEdgeGeometryPolicy,
  Point,
} from '@opsydyn/foldkit-zloz';

// Share one pure curve function across both policy contexts.
const curve = ({ source, target }: { source: Point; target: Point }) => ({
  path: `M${source.x},${source.y} Q${source.x},${target.y} ${target.x},${target.y}`,
  labelPosition: undefined,
});
const edgeGeometry: ZlozEdgeGeometryPolicy = curve;
const connectionGeometry: ZlozConnectionGeometryPolicy = curve;

// zlozView options alongside the host's normal id, label and onEvent:
// edgeGeometry,
// connectionGeometry,
// renderConnection: (context, builder) => builder.path([
//   builder.D(context.path), builder.Fill('none'),
//   builder.Stroke(context.stroke), builder.StrokeWidth('5'),
// ], []),
```

`connectionGeometry` returns the same geometry result shape as the finished-edge
policy, or `undefined` for built-in geometry. Defaults are straight for new
connections and follow authored path style during reconnection. Valid and
rejected hovered ports use their canonical anchors; free space uses the cursor.
Source reconnection keeps the logical output at the path start.

`renderConnection` receives that geometry and core feedback plus default `stroke`,
`strokeWidth` and `dashArray`. It owns decorative SVG through the host builder;
return `undefined` for the default dashed wire, or empty SVG to omit the visual
without disabling the interaction. The package owns pointer capture and the
pointer-inert, hidden-from-assistive-technology preview layer. Preview SVG must
stay decorative. Existing native port buttons retain keyboard operation.

Default colors use `--flow-selection`, `--flow-valid-target` and
`--flow-invalid-target`. Rejection reasons also reach the existing live status.
Gesture data stays in Model; geometry is derived and callbacks remain host view
configuration. Preview functions and styles are not serialized.
The sample combines **Edge design** with **Connection preview** choices for
dashed, ribbon and hidden presentation in both card and SVG node designs.

### Custom port anchors

Ports support two mutually exclusive positions. Existing documents keep their
cardinal side/offset form. Custom anchors use normalized coordinates in the node
box; both fractions must be finite and between 0 and 1:

```ts
import type { Port } from '@opsydyn/foldkit-zloz';

const cardinal: Port = { id: 'out', kind: 'output', side: 'right', offset: 0.5 };
const diagonal: Port = {
  id: 'out',
  kind: 'output',
  side: 'right',
  anchor: { x: 0.84, y: 0.16 },
};
```

`side` is the outward routing/reconnection hint for either form. It does not move
an explicit anchor. Do not provide both `offset` and `anchor`. `PortPosition`
models that choice; `PortSide` names its direction. Use `portAnchor(port)` for
normalized coordinates, `portPosition(node, id)` for the canonical world point,
and `portBoundaryPosition(node, id)` for its projection onto the hinted box side.

The same authored point drives public port presentation, edge geometry, previews
and snapping to targets. Coordinates rescale with authored width and measured
height. Frame primitives separate a border-free coordinate plane from the visual
shell: frame attributes/classes/styles decorate that measured static shell, so
borders and padding do not shift port centers. Keep ports as direct logical frame
children and avoid positioned/transformed wrappers between them and the frame.
Do not style private geometry elements. The existing restrictions against moving
frames with CSS transforms or margins still apply.

Change one or many positions atomically through the core:

```ts
const next = updateEditor(state, {
  type: 'PortPositionsChanged',
  positions: [
    {
      endpoint: { node: 'review', port: 'out' },
      position: { side: 'right', anchor: { x: 0.84, y: 0.16 } },
    },
  ],
});
```

Edits retain IDs, directions, labels and edge metadata. The batch validates before
publication, detaches anchor coordinates, advances revision, clears cached routes
and creates one Undo step. Duplicate/unknown endpoints and malformed positions
are rejected. No-op batches leave history unchanged. Read-only and active-gesture
protection use the normal core path.

ELK receives fixed boundary projections and rejoins its routes to the exact
anchors. Force routing extends its leads beyond the hinted node boundary before
avoiding other cards. Reconnection controls use the same boundary hints so they
remain reachable outside opaque node shells. Adapter routes may traverse their
own endpoint node; custom-shape clipping/obstacle geometry is not inferred.

`serializeGraph` preserves anchors in version 1 documents; legacy side/offset
documents remain readable. Builds predating anchor support may reject custom
anchor documents. Outside-box anchors and arbitrary routing normals are not
supported in this slice. The sample's **Port anchors** selector demonstrates
cardinal and diagonal circle-perimeter positions; it derives its value from the
document so Undo, Redo and imports stay consistent.

## Repository performance benchmarks

From this monorepo, `bun run --filter @opsydyn/foldkit-zloz bench:choosers`
measures chooser resolution, projection and field construction. The
[benchmark method, raw results and browser driver](../../apps/zloz-demo/evidence/endpoint-chooser-benchmark.md)
cover reproducible workbench typing measurements and the retained-node comparison.
The [validation indexing follow-up](../../apps/zloz-demo/evidence/endpoint-chooser-indexing.md)
compares per-resolution indexes against that baseline with fresh policy checks.
The [pending-creation retention follow-up](../../apps/zloz-demo/evidence/endpoint-creation-retention.md)
adds retained-creation comparisons and production feedback checks.
The [live-port body-retention report](../../apps/zloz-demo/evidence/node-body-policy.md)
adds policy-enabled comparisons and focused-control qualification.
These are repo-only diagnostic tools with no machine-dependent CI timing gate.

### Host-owned sidebar and fill-height layouts

`height: 'fill'` sizes the view inside a bounded flex/grid parent; omitting height
retains the 440px default and numbers still mean pixels. `renderLayout` receives
`ZlozViewLayoutParts`: `canvas`, `canvasId`, `help`, `controls`, `creation`,
`minimap`, `status` and `connections`. Controls, creation and minimap can be null
when disabled. The same native parts implement the default presentation.

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow canvas',
  onEvent: zlozInput,
  height: 'fill',
  viewportControls: true,
  minimap: true,
  renderLayout: (parts, builder) =>
    builder.div(
      [
        builder.Style({
          display: 'grid',
          'grid-template-columns': '20rem minmax(0, 1fr)',
          height: '100%',
          'min-height': '0',
        }),
      ],
      [
        builder.aside(
          [builder.Style({ overflow: 'auto', 'min-height': '0' })],
          [
            builder.a([builder.Href('#' + encodeURIComponent(parts.canvasId))], ['Skip to canvas']),
            parts.help,
            ...(parts.controls ? [parts.controls] : []),
            ...(parts.creation ? [parts.creation] : []),
            ...(parts.minimap ? [parts.minimap] : []),
            parts.connections,
            parts.status,
          ],
        ),
        builder.section([builder.Style({ 'min-width': '0', 'min-height': '0' })], [parts.canvas]),
      ],
    ),
});
```

Give the host container a definite height. Keep each part at most once and retain
the help/ID relationship. Theme variables scope the entire result, including
relocated controls. Feature gates, diagnostics, policy reasons and typed events
are already resolved. A relocated minimap retains native pointer/keyboard input
through its own Live-scoped Mount; no canvas DOM protocol needs to be copied.
The pure root export and numeric/default layout remain compatible.

## Named editions and read-only history

```ts
import {
  captureEdition,
  appendEdition,
  serializeEditions,
  parseEditions,
  createHistoryReview,
  updateHistoryReview,
  compareEditions,
} from '@opsydyn/foldkit-zloz';
import { zlozHistoryGhosts } from '@opsydyn/foldkit-zloz/foldkit';

const edition = captureEdition({
  id: 'ordering-v1',
  name: 'Ordering · initial design',
  snapshot: { graph: model.editor.graph, viewport: model.editor.viewport },
});
const editions = appendEdition(model.editions, edition);
const archive = serializeEditions(editions);
const reopened = parseEditions(archive);
const review = createHistoryReview(reopened[0]!, model.editor);
// Route historical canvas events here; retain model.editor as the working editor.
const nextReview = updateHistoryReview(review, event);
const comparison = compareEditions(baselineEdition, selectedEdition);
// Optional world-overlay content; emit an accessible change list alongside it.
const ghosts = zlozHistoryGhosts(h, comparison, {
  enabled: model.showGhosts,
  nodes: true,
  edges: true,
  movements: true,
});
```

Editions are validated, detached and deeply frozen graph/optional-camera
checkpoints. Supply stable IDs and names yourself; duplicate IDs reject append,
and no clock or ID generator is hidden in core. The separate
`foldkit-zloz-editions` version-1 archive contains captured editions, not an
implicit working document or session Undo stack. Existing graph/snapshot wire
version 1 is unchanged. Parse validates versions, reserved fields, all graphs,
cameras and duplicate identities. Host Commands own file/storage/network I/O,
retention and input budgets. Capturing, comparing and encoding use full snapshots;
no compressed journal or large-history performance guarantee is claimed.

`createHistoryReview` builds a separate read-only editor. Keep the complete working
editor while inspecting it; returning means discarding the review. Selection,
focus, pan, zoom, Fit and surface measurements go through `updateHistoryReview`.
Its explicit navigation allowlist blocks graph edits, node measurements and Undo/
Redo; `isHistoryNavigationEvent` lets hosts disable corresponding controls. New
editor events are blocked unless explicitly qualified. Route host-specific import,
layout, direct model replacement and other mutation actions separately; do not let
them overwrite the working editor while a review is displayed. Cancel or reject
stale pending work when entering review. After resizing during review, refresh
only the present surface measurement on return; retain its camera, graph and Undo.

`compareEditions` uses IDs, not labels or array positions. Node meaning includes
label, architecture, host data, group ownership and port identity/kind/label.
Layout includes position, dimensions, appearance, constraints and port locations.
Edge endpoints, label and data are meaning; path style and core path geometry are
layout. Camera-only and array paint-order changes do not create graph change entries. Object-key order does not create changes. Custom renderer output and
external layout routes are not archived or compared. Use `semanticChanged` and
`layoutChanged` flags independently; renaming an ID is an addition/removal, not a
guessed identity match.

`zlozHistoryGhosts` composes inside `renderWorldOverlay`. It creates inert SVG
outlines, dashed baseline edges and movement connectors without editor nodes,
ports, hit targets or Undo entries. Node, edge and movement switches are
independent; `enabled: false` omits the layer. Optional `renderNode`, `renderEdge`
and `renderMovement` callbacks replace marks with inert SVG; undefined keeps the
default and null omits it. Keep custom content noninteractive. The visual-only SVG
is aria-hidden; supply a textual change list/legend through the comparison model.
Use the complete uncollapsed comparison in this slice; host filtering/collapse
projections and custom route fidelity require explicit integration. Themes use
scoped Zloz paint tokens. Minimal-mode masking is a host presentation choice.

This is named snapshot review, separate from session Undo and the monotonic editor
freshness revision. Playback, fork/merge, collaborative history and agent history commands remain
subsequent slices. Archive import and undoable restore are described below. The workbench demonstrates named
capture, portable archive download, rewind, baseline comparison, ghost controls
and return; it labels session ownership and does not automatically persist data.

## Import and restore editions

```ts
import {
  parseEditions,
  mergeEditions,
  resolveEditionRestore,
  restoreEdition,
} from '@opsydyn/foldkit-zloz';

const incoming = parseEditions(archiveText);
const merged = mergeEditions(model.editions, incoming);
// merged.type is merged / unchanged / blocked. Never discard the working editor.
const options = { expectedRevision: model.editor.revision, policy: hostRestorePolicy };
const preview = resolveEditionRestore(model.editor, selectedEdition, options);
// Keep the target and expectedRevision in your Model. On explicit confirmation:
const result =
  preview.type === 'ready'
    ? restoreEdition(model.editor, preview.edition, {
        expectedRevision: preview.expectedRevision,
        policy: currentRestorePolicy,
      })
    : null;
// Only result?.type === 'restored' publishes a new graph transaction.
```

`mergeEditions` is additive and atomic. Identical IDs with identical names and
snapshots are skipped, ignoring JSON object-key order. Conflicting IDs or duplicate
incoming IDs reject the entire batch. No edition is overwritten; an unchanged
merge retains the existing collection reference. Parse errors throw through the
canonical codec, and merge conflicts return `ZlozEditionMergeDecision`.

`ZlozEditionRestoreOptions.expectedRevision` is required. Store it with the exact
target when presenting a preview and retain it at confirmation; passing the latest
revision instead would defeat stale-intent protection. Both resolve and commit
check freshness, read-only state, idle gestures, canonical target validity and
current policy. Restore requires enabled Undo history. Exact graph no-ops return
unchanged without a new revision or Undo entry. Invalid editions fail before
mutation; expected denials return a blocked reason and the original editor.

Restore uses the existing graph transaction: one Undo entry, a new monotonic
freshness revision, invalidated routes and cleared connection/draft state. The
working camera is preserved; the edition's saved camera is for inspection.
Undo/Redo recover the previous/restored graphs. The edition collection is not part
of graph Undo and is never modified by restore.

`ZlozEditionRestorePolicy` extends `EditorPolicy` with `canRestoreEdition` for whole
replacement rules, including fields without granular hooks. Existing deletion,
movement/reparenting, resize, architecture, appearance and retained-node port-edit
hooks are enforced. Port kind changes check remove/add. Node deletion and initial
ports on added nodes follow the existing node operation semantics. New/rewired
connections recheck connection policies against the complete candidate graph
without that edge; reconnect hooks use the original edge/current graph, and an
unchanged endpoint is not a new port connection. Policy vetoes, including blank
strings, never silently become permission. Keep policies pure and pass current
policy at confirmation rather than caching a ready result.

The workbench reads a single archive up to 5 MiB with strict UTF-8 decoding,
validates before merging, and rejects cancelled, superseded or collection-stale
results. Import preserves the working graph/camera/Undo. A preview, cancel action,
live protection reason and explicit **Restore as new change** action demonstrate
the package contract. Editions remain session-owned until exported; import does
not enable automatic persistence. Forks, merging branches and playback remain
separate slices.

### Fork an edition into another model

`captureModelDocument` owns portable document identity separately from local
node/edge/port IDs. `forkEdition` selects an edition in that model's collection,
checks distinct identity and an optional `canForkEdition` veto, and returns a new
immutable document. The source is untouched. Each document owns its own edition
IDs; the fork starts without captured editions. `origin` pins the immediate
parent's ID/name and exact edition. It is not a complete ancestry DAG or an
attestation of ownership. Hosts allocate model IDs unique within their registry.

```ts
import {
  captureModelDocument,
  forkEdition,
  createModelEditor,
  serializeModelDocument,
  parseModelDocument,
} from '@opsydyn/foldkit-zloz';

const source = captureModelDocument({
  id: 'ordering',
  name: 'Ordering',
  snapshot: { graph },
  editions: [edition],
  origin: null,
});
const fork = forkEdition(source, edition.id, {
  id: 'ordering-alternative',
  name: 'Alternative ordering',
});
if (fork.type === 'forked') {
  const portable = parseModelDocument(serializeModelDocument(fork.document));
  const editor = createModelEditor(portable); // fresh editable session; empty Undo/Redo
}
```

The independent `foldkit-zloz-model` version-1 JSON envelope preserves snapshot,
editions and pinned origin. Existing graph/snapshot and edition-archive version-1
formats remain unchanged and do not carry model identity. Old strict snapshot
readers reject model envelopes; use `parseModelDocument`, then `createModelEditor`.
Editor options remain host-owned; the snapshot camera is used unless explicitly
overridden. Undo, selection, gestures, routes and clipboard are never persisted.
Forking is distinct from undoable restore and does not merge model branches.

The standalone CLI validates model envelopes and reports explicit metadata losses
when projecting them to Mermaid. The workbench Open model JSON action opens a
separate session and rejects already-open IDs without overwrite or renaming. Its
existing diagram importer remains graph/snapshot-only. Use the explicit model
codec when identity, editions and origin must survive a round trip.

## Atomic architecture patterns

`insertPattern` adds any self-contained graph fragment without replacing existing
content. `createArchitecturePattern('c4-context' | 'ddd-aggregate' | 'event-storming')` supplies fresh,
customizable starters; use your own graph for other patterns.

```ts
import { createArchitecturePattern, insertPattern } from '@opsydyn/foldkit-zloz';

const result = insertPattern(editor, createArchitecturePattern('ddd-aggregate'), {
  offset: { x: 800, y: 40 },
  policy: {
    canInsertPattern: (fragment, current) => null,
    canConnectPort: (endpoint, proposed) => null,
  },
});
if (result.type === 'inserted') {
  editor = result.editor;
  const newRootId = result.nodeIds.get('source');
}
```

Every node and edge gets a fresh ID, returned in separate `ReadonlyMap`s. Parent
and endpoint references are remapped; node-local port IDs, geometry, semantics
and JSON data survive. JSON strings are opaque and are never rewritten as IDs.
Offsets translate all world positions equally, including nested groups. Placement
and overlap handling belong to the host.

The complete fragment is validated and detached. Invalid input throws `ZlozError`;
expected vetoes return `blocked` with the original editor and a nonempty reason.
Empty fragments return `unchanged`. Read-only/busy editors and disabled Undo
block insertion. Whole-pattern and existing connection policies run on every
call; each edge policy sees the complete proposed graph excluding that edge.
Selection policies filter the new root selection independently of insertion.
One successful insertion records one Undo step and clears Redo/routes, preserving
the camera, clipboard, model identity and editions. Persistence stays version one.

## Event-storming notes

The `EventStormingNodeArchitecture` family models workshop process notes:
`{ family: 'event-storming', role: 'command' | 'domain-event' | 'policy' | 'actor', description?: string }`.
These are ordinary nodes using existing geometry, ports, grouping membership,
serialization and semantic-edit Undo. They cannot themselves be group boundaries.
The separate DDD `domain-event` role keeps its existing structural meaning.

```ts
import { createArchitecturePattern, insertPattern } from '@opsydyn/foldkit-zloz';
import { zlozEventStormingNode } from '@opsydyn/foldkit-zloz/foldkit';

const result = insertPattern(editor, createArchitecturePattern('event-storming'));
// In zlozView options:
const renderNodeShell = (context, h) => zlozEventStormingNode(context, h);
```

The starter shows Customer → Place order → Order placed → a policy → Request
payment. Edges describe an illustrative process; notes do not execute policies or
enforce causality. Adapt labels, ports, outlines and relationships to your model.

`ZlozEventStormingNodeOptions` offers `renderType`, `renderName`,
`renderDescription`, `renderBody`, `renderControls`, `attributes` and `bodyCache`.
Undefined slot results retain defaults, null omits content, and an empty controls
array hides chrome. Keep interactive UI in `renderControls`; sockets and control
feedback stay outside cached inert artwork. Compose this renderer with C4/DDD
renderers using their undefined fallback.

Scoped theme tokens `eventStormingCommand`, `eventStormingEvent`,
`eventStormingPolicy` and `eventStormingActor` override role accents, including
with host/Pleat variables. Light/dark defaults retain visible type labels so color
is supplemental. Outlines and geometry remain independent of semantic roles.
Graph/model envelopes remain version one; older readers can reject this new
semantic family. Mermaid strict export rejects omitted architecture metadata;
report mode explicitly discloses that loss. This is a bounded vocabulary, not a
complete workshop methodology or process engine.

## Opt-in edition playback

`createEditionPlayback` creates a session cursor over an ordered collection of
unique edition IDs. It stores no graphs, browser resources or working editor.
Hosts own the clock and resolve the selected ID against their own edition store.

```ts
import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
} from '@opsydyn/foldkit-zloz';

let playback = createEditionPlayback(
  editions.map((edition) => edition.id),
  {
    intervalMs: 2000,
    reducedMotion: prefersReducedMotion,
  },
);
playback = updateEditionPlayback(playback, { type: 'PlayClicked' });
// From a host-owned subscription, only while status is 'playing':
playback = updateEditionPlayback(playback, { type: 'Elapsed', milliseconds: 2000 });
const selectedId = playbackEditionId(playback);
```

Playback starts paused. Reduced motion defaults true until explicitly supplied;
`editionPlaybackReason` gives a visible reason when automatic play is unavailable.
Events include PlayClicked, PauseClicked, RewindClicked, PreviousClicked,
NextClicked, EditionSelected, IntervalChanged and ReducedMotionChanged. Rewind,
manual steps, seeking, speed changes and enabling reduced motion pause/reset timing.
Removing reduced motion never resumes automatically. Empty/single collections
cannot play automatically; manual steps remain available with reduced motion.

At most one edition advances per elapsed event; overshoot is discarded to avoid
catch-up bursts. Playback pauses at the end. Play at the last edition restarts at
the first without looping. Invalid identities, intervals or active elapsed values
throw `ZlozError`. Replace the controller when the edition collection changes.

Use `createHistoryReview` for the selected edition and `compareEditions` plus
`zlozHistoryGhosts` for optional comparison. Preserve the working editor and its
Undo. Hosts must cancel subscriptions and reject stale scoped ticks after pause,
model/collection changes, leaving history or lifecycle changes. The workbench
uses a scoped Effect Stream timer with model/run identity, pauses for hidden
pages and live reduced-motion changes, and lets manual inspection take priority.
Playback is session-only and never changes portable document formats.

## Composable playback controls

Core `resolveEditionPlaybackControls` projects the cursor into named actions,
status text and availability reasons. `blockedReason` adds a host restriction on
play/manual navigation; `automaticReason` adds a restriction on automatic play
only. Core reduced-motion and boundary guards remain in force. Pause stays
available while running. Blank reasons retain a nonempty fallback, and labels can
be localized with the `labels` record. `editionLabel` resolves your store's name
without putting edition data inside the cursor.

```ts
import { resolveEditionPlaybackControls } from '@opsydyn/foldkit-zloz';
import { zlozPlaybackControls, zlozPlaybackControl } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveEditionPlaybackControls(playback, {
  editionLabel: currentEditionName,
  blockedReason: editingReason,
  automaticReason: visibilityReason,
});
const controls = zlozPlaybackControls(h, context, toMessage, {
  renderControl: (action, builder, onEvent) =>
    zlozPlaybackControl(builder, action, onEvent, [builder.Class('my-pill')], [action.label]),
});
```

The Foldkit entry exposes the group composition and individual native helpers
`zlozPlaybackControl`, `zlozPlaybackStatus` and `zlozPlaybackReason`. The component
is unstyled. Customize `renderControl`, `renderStatus`, `renderReason` and
`renderLayout`, or use the helpers independently inside your own frame. Slot
undefined retains a default; null omits a part. `controls` sets an ordered subset
(duplicates are removed); `[]` omits all controls. Frame/status/reason labels are
configurable, and status/reason helpers accept custom children and label options.

Native helpers preserve button types, accessible names, disabled state, reason
descriptions and polite status semantics. Supply a Key through attributes when
composing repeated actions in one parent. Custom HTML can replace them entirely;
its semantics then belong to the consumer. Contexts are view projections, not
permission grants: keep live update guards and host timer/lifecycle handling.
No state, generated DOM IDs, subscription or persistence format is introduced.
The workbench demonstrates custom icon pills, a timeline badge and reason layout
using these same public APIs.

## Edition scrubber and explicit seeking

Core `resolveEditionScrubber` derives ordered entries, current value text and
manual-seek restrictions from the existing playback cursor. Customize names with
`labelEdition`, `formatValueText`, `label` and `emptyLabel`. No ordinal counters
are required in the visible readout. Manual seeking remains available with
reduced motion.

```ts
import {
  resolveEditionScrubber,
  editionScrubberRequest,
  resolveEditionSeek,
  updateEditionPlayback,
} from '@opsydyn/foldkit-zloz';

const context = resolveEditionScrubber(playback, {
  labelEdition: (id) => names.get(id) ?? id,
  blockedReason: editingReason,
});
const request = editionScrubberRequest(context, '3');
// In update: recheck the host session and resolve against current state/policy.
const decision = resolveEditionSeek(playback, request, { blockedReason: editingReason });
if (decision.type === 'ready') playback = updateEditionPlayback(playback, decision.event);
```

Requests carry an edition ID, not a saved array index. Reordering cannot redirect
the request to a different edition. Missing IDs and malformed/out-of-bounds native
values are ignored; no clamping or implicit substitute is chosen. Host vetoes
return a nonempty blocked reason. Applying the ready EditionSelected event pauses
playback and clears elapsed timing. The host projects a read-only review while
preserving the working editor and Undo.

The `/foldkit` entry exposes `zlozEditionScrubber` and individual input, readout,
reason and Open-button helpers. The controlled native range supports browser
keyboard navigation and uses `aria-valuetext` for human labels. Its readout is
non-live to avoid another announcement of each range value. A single edition
locks the range but remains explicitly openable; Open also handles an unchanged
first position while present.

Use `renderInput`, `renderReadout`, `renderReason`, `renderOpen` and `renderLayout`
to replace, omit or rearrange parts. Undefined retains defaults and null omits a
part. Helpers are unstyled, generate no DOM IDs and allow attributes/custom
children/labels. They create no draft selection, timer or persistence format.
Custom HTML owns its own semantics. Hosts must check current identity, policy and
callback lifetime in update; the workbench uses a dedicated seek-session token
that survives continuous seeking but expires on leaving history, returning to
present, collection/model changes or disable/re-enable. Its eight-checkpoint
sample is synthetic demonstration data, not a business change log.
