# ADR 0004: Make Flow presentation composable through public contracts

## Status

Accepted for node/group composition, edge geometry, connection previews, custom port anchors and viewport navigation on
2026-11-05 following user approval. The broader layering principle guides subsequent slices; arbitrary
port geometry and complete overlay/control composition remain follow-on work.

## Context at the initial audit

ADR 0003 separates the pure editor from its optional FoldKit view and layout
adapters. That boundary remains useful. Presentation flexibility is incomplete:

| Surface                   | Current public capability                                                 | Constraint observed in source                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor state and behavior | `createEditor`, `updateEditor`, typed events, policy and layout contracts | Consumers can own state without the bundled view. Preserve this boundary.                                                                                            |
| Node contents             | `renderNode(node, h)`                                                     | The card wrapper, title handle, ports, resizing affordances and spacing are still imposed by `flowView`.                                                             |
| Groups                    | Authored bounds, membership and collapse events                           | Boundary markup and header controls are private renderer implementation.                                                                                             |
| Edges                     | `renderEdge`, `edgeAppearance`, authored routes/path styles               | The callback replaces decorative SVG; the default hit area and label placement still use Flow's geometry. A completely different path can disagree with hit testing. |
| Ports                     | Named ports with side/offset geometry                                     | Port buttons, styling and the binding protocol are private. Arbitrary anchors are not a public geometry policy.                                                      |
| Backgrounds               | Built-ins or custom HTML/SVG through the host builder                     | This is an existing public composition example to retain.                                                                                                            |
| Controls and overlays     | Feature flags, diagnostics, tokens and some private helpers               | Consumers can hide many parts, but cannot compose equivalent custom parts from a complete public primitive set.                                                      |
| Input lifecycle           | Scoped Mount resource                                                     | `FlowInput` and its DOM protocol are private; a replacement shell currently risks copying internal attributes.                                                       |

Evidence is the current `packages/foldkit-flow/src/index.ts`, `types.ts`,
`foldkit.ts`, `geometry.ts`, `input.ts`, `mount.ts`, and optional layout packages.
In particular, `renderNode` is called inside an already-built card and `renderEdge`
explicitly preserves Flow's hit area. Existing CSS variables and flags are useful,
but do not establish full markup or interaction composition.

## Decision

Treat design freedom as a public package contract with four layers:

1. **Headless behavior.** The host owns Model and messages. The pure core owns
   graph validation, transactions, geometry rules, connection policy, history and
   stale-layout protection. No FoldKit, browser or styling dependency enters it.
2. **Interaction primitives.** Public FoldKit building blocks provide frames,
   drag handles, ports, resize affordances, edge interaction targets and scoped
   canvas input. They encapsulate the binding protocol and keyboard semantics.
3. **Presentation composition.** Typed slots can replace complete node/group
   shells, ports, labels, controls and overlays. They receive Model-derived context
   and the host's `HtmlBuilder<Message>`. They can compose default parts or return
   custom markup without a second store, DOM mutation or private imports.
4. **Default presentation.** The shipped view is built from those same public
   primitives and slots. It has no privileged interaction path unavailable to a
   consumer's design. Tokens/classes and per-part style inputs are conveniences,
   rather than the only way to change structure.

A slot may own appearance and markup. Geometry and hit testing must still agree
with the Model. World position, authored dimensions, measurements and port anchors
are explicit contracts, not incidental CSS values to override. A designer needing
a different anchor/path model needs a supported geometry extension, not a visually
different path over an unchanged interaction target.

### Acceptance rules for every extension

- Optional presentation can be replaced, composed or omitted independently.
- Geometry-critical bindings have documented public primitives; consumers never
  copy `data-flow-*` attributes from source to reproduce normal interactions.
- Consumers can control visual classes, spacing, typography, borders, icons and
  shape without `!important`, selector-specificity battles or editing package code.
- Reserved geometry/input responsibilities are explicit. Styling does not silently
  become another source of layout state.
- The same typed event, validation, measurement and history paths serve default
  and custom presentation. No separate custom-renderer state machine is permitted.
- Keyboard operation, focus semantics and names travel with primitives. Replacing
  visual chrome must not require reconstructing accessibility behavior from scratch.
- Renderer selection is view configuration; document identity and metadata survive
  presentation changes. Intentional content remeasurement remains a typed fact.
- Existing render callbacks, defaults and package exports remain compatible while
  the new composition surface is introduced.

### Geometry extensibility is a separate explicit contract

The first shell slice must not claim arbitrary geometry support. Later work must
qualify replaceable port anchors, edge paths/hit areas and label anchors together,
including layout-adapter agreement. The current four-side port model remains the
supported contract until that slice is designed and tested. Decorative callbacks
alone must not be advertised as a replacement geometry engine.

## Alternatives and simplicity check

| Option                                                     | Assessment                                                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Add more visibility/style flags to `flowView`              | Useful for preferences, insufficient for a different component structure. An ever-growing flag matrix is not the architectural solution. |
| Require CSS overrides against default HTML                 | Couples consumers to private markup, specificity and hard-coded dimensions. Does not meet the requested engineering contract.            |
| Build a separate custom renderer/input runtime in each app | Duplicates behavior, focus handling and lifecycle ownership. Rejected.                                                                   |
| Public primitives plus typed composition slots             | Selected direction; reuses FoldKit's builder and Flow's existing core and input lifecycle.                                               |

Outcome: two different designs can use the same editor behavior. Entanglement
avoided: no new UI runtime, shared mutable store or app-owned copies of input
logic. Safeguards preserved: Model ownership, typed messages, validation, keyboard
semantics, cleanup and one transaction per edit. Omitted scope: a universal widget
framework, speculative plugin registry, or a wholesale renderer rewrite in one slice.
Remaining uncertainty: the exact slot/context API must be qualified against real
alternative designs before it is treated as stable.

## Minimum credible implementation slice

1. Extract public unstyled node/group frame, drag-handle and port primitives from
   the existing view, keeping resource ownership and measurements in the package.
2. Add full-shell composition hooks alongside the existing content-only callback.
   Rebuild the default node/group presentation using those public primitives.
3. Build a conventional card and a substantially different circular/SVG presentation
   using supported cardinal port anchors. Neither may copy private attributes,
   duplicate input code or override internal selectors.
4. Exercise drag, connection creation, resize/measurement, selection, keyboard
   operation, cancellation, grouping and Undo in both presentations.
5. Install a packed consumer outside this workspace and compile/run its custom
   shell with the host builder's message type. Capture browser evidence for both
   designs and run the repository verification gates.

Follow-on slices: port presentation and geometry policy, shared edge geometry/hit
area/label anchors, then composable controls and overlays. Each is a separate
reviewable contract; the broad principle does not imply those surfaces are already
implemented.

## Decision challenge

**Trigger:** shared package and presentation/interaction boundary changes.

**Platform ownership:** FoldKit already owns typed view construction, messages,
Commands and managed lifecycle. Flow owns graph behavior and the interaction/
geometry agreement. The host owns product design, state and persistence.

**Strongest counterargument:** a speculative all-purpose slot system can create
more coupling and API burden than it removes. Qualify the minimum primitive set
with two contrasting designs before expanding it.

**Claim-to-evidence:** current core and callbacks establish the starting boundary;
source audit establishes the missing shell/port/control seams. Reusable custom
interaction and full designer freedom are proposed outcomes, not observed proof.
The outside-workspace consumer and browser journeys above are the required proof.

**Stop conditions:** a design requires copied private bindings, duplicate gesture
state, CSS specificity workarounds, divergent hit geometry, lost keyboard behavior,
or a browser/framework dependency in the pure core.

**Verdict: proceed** with the bounded composition slice after review of this
proposal. This is not approval of an unqualified universal extension API.

## Implementation and qualification

The first slice adds public unstyled frame, drag-handle, port and resize primitives
and full node/group shell hooks in the optional `/foldkit` entry. The default view
uses those primitives. Context supplies optional default controls for composition;
consumers may instead use native host controls and typed core events.

The sample switches between cards and complete circular SVG shells with custom
ports, group chrome and resize controls. Content-driven height changes follow the
existing measurement and history-rebasing path; a shell switch does not rewrite
document metadata. Ordinary node resize buttons also support keyboard width
nudging through a typed event, with limits and history retained.

Qualification covers rendered-shell input integration, a packed external consumer,
and browser journeys for both designs: selection, keyboard movement, drag,
connection creation, resize/measurement, cancellation, grouping and Undo. Browser
screenshots and the qualification record live in `apps/flow-sample/evidence/`.
The remaining follow-on surfaces above are not claimed as implemented.

## Shared edge geometry policy

The next approved slice adds a pure `FlowEdgeGeometryPolicy` and
`resolveEdgeGeometry` to the headless entry. It receives canonical endpoints,
projected collapsed-group boundaries, layout route points and the built-in
geometry. It returns one SVG path and an optional label anchor. Returning
`undefined` retains the existing authored-style/layout/default behavior.

The FoldKit view resolves geometry once per visible edge. Decoration, the public
`flowEdgeHitTarget` primitive, labels and toolbar placement consume that result.
The selection corridor defaults to 12 world units and may be set per edge through
`edgeAppearance.hitWidth`. Default decoration now uses the same transparent
selection corridor as custom decoration. Native connection-list controls retain
the keyboard selection path; reconnection handles remain tied to canonical ports.

A custom policy is explicit view configuration, not serialized graph metadata or
a second state machine. It may choose to override an authored style or layout
route; it sees the built-in result so it can preserve either. The sample's raised
arcs preserve explicit styles and layout routes. Policies must honor the supplied
endpoints and provide a label anchor consistent with their path; the package does
not parse arbitrary SVG to infer anchors. Empty paths, non-finite anchors and
invalid hit widths fail with the existing `FlowError` contract.

Alternatives rejected: changing only the decorative callback (leaves stale hit
areas/labels), separate callbacks for path/hit/label geometry (can disagree), and a
new SVG routing/parser dependency (unnecessary for a caller-owned pure policy).
There is no new runtime dependency or document format. Arbitrary port anchors,
custom connection previews and a complete control/overlay slot API remain future
slices. Custom edge routes do not expand Fit view bounds or avoid obstacles
automatically; those capabilities need a separate bounds/routing contract.

Qualification covers pure resolution/fallback, collapsed projections, rendered
path/hit/label/toolbar agreement, packed consumers, and browser editing journeys
in both card and SVG node designs. Evidence is recorded in
`apps/flow-sample/evidence/edge-geometry.md`.

## Generated public API reference

The public contract is also exposed as a TypeDoc reference generated from the
core, optional FoldKit view, ELK, force and force-eligibility entry points. Module
names and TSDoc describe package ownership without changing imports or runtime
behavior. A contract guide accompanies generated signatures and source links.

The reference reuses the repository's existing TypeDoc/Pages delivery pattern at
`/fold-kit-experiments/flow/api/`, alongside the existing Viz API. Generated Flow
HTML is ignored by Git, excluded from npm package files, and regenerated by CI;
source exports remain the authority. TypeDoc warnings fail the Flow docs build.
The docs site, sample and Viz API provide discovery links. Updating the workflow
prepares publication after merge; local generation does not deploy or publish npm
packages. No new hosting service or runtime dependency is introduced.

## Connection-preview composition

The next approved slice exposes `resolveConnectionPreview` and a separate
`FlowConnectionGeometryPolicy` in the pure core, plus `connectionGeometry` and
`renderConnection` in the optional FoldKit view. Both preview and finished-edge
policies accept logical source/target points and return the same geometry shape.
Hosts can share a pure curve function without inventing graph edges or fake ports
for free cursor positions. Existing-edge metadata is available only when
reconnecting. Authored built-in path styles use a shared geometry helper.

The reducer keeps accepted targets mutually exclusive with optional rejected
endpoint/reason details. Hover and drop share direction, duplicate and host-policy
validation. Native input reports any hovered port so wrong-direction ports can
produce explicit feedback. Preview resolution reads this Model feedback without
running the connection policy again. Canonical anchors, world-space cursor
conversion and collapsed boundary projection stay in the package. Reconnecting
a source draws from the moving output toward the fixed input.

The SVG slot is decorative and uses the host builder; the package retains the
pointer-inert preview layer and input lifetime. Undefined keeps the default wire;
empty SVG omits its visual without changing validation or commit behavior.
Invalid feedback also reaches the existing live status. No new runtime,
persistence format, duplicate gesture store or DOM mutation is introduced.

Alternatives rejected: reusing the complete-edge context with fabricated IDs,
re-evaluating connection policy in the view, and copying private input bindings
into the sample. Dedicated geometry/render hooks are smaller and preserve core
ownership. Arbitrary port anchors and full controls/overlay composition remain
follow-on work. Qualification includes pure and rendered tests, packed consumers,
TypeDoc, and browser creation/reconnection/cancellation/Undo in both node designs.

## Model-owned custom port anchors

The approved anchor slice adds a mutually exclusive `PortPosition` union:
legacy cardinal side/offset or normalized box coordinates with a cardinal routing
hint. Existing ports and documents remain readable. Anchors are finite fractions
in [0, 1]; both position forms together are invalid. Functions, DOM references and
view-specific coordinate stores are not added to document data.

The pure core owns normalization, world coordinates, boundary projection,
validation and the atomic `PortPositionsChanged` event. Positions detach caller
coordinates and preserve IDs, kind, labels and edges. One batch is one document
revision/history transaction and invalidates routes/stale layout results. Empty
or unchanged valid batches do not add history.

The FoldKit frame keeps a border/padding-free coordinate plane around the
measured static visual shell. Public attributes decorate that shell. This avoids
CSS borders changing the containing box used by port percentages; the host does
not copy bindings or compensate with selector overrides. Ordinary height remains
a measurement fact. Group bounds remain authored. Positioned/transformed nested
containers are outside the direct-frame-child port contract.

ELK and force adapters consume core boundary projections along the side hint.
ELK routes its fixed boundary ports then rejoins the authored interior/custom
points; force leads exit the node box before avoiding other cards. Reconnection
controls use boundary hints to stay reachable outside opaque node shells. Core
edge and preview geometry continue to resolve the canonical authored points.

Alternatives rejected: CSS-only handles (geometry disagrees), per-view anchor
callbacks (layout snapshots cannot reproduce them), and arbitrary routing normals
or outside-box coordinates in this first slice (larger layout contract). The
side hint is deliberately separate from the anchor's location. Adapters do not
infer the node's painted shape or its internal obstacles. Version 1 gains an
additional accepted port representation; older strict readers may reject it.

Qualification covers invalid/ambiguous data, save/reload, atomic edits and Undo,
measurement, stale layouts, thick visual borders, real ELK for every side, force
route leads, external packed APIs and browser geometry/editing in both node
designs. The sample's coordinate preset is illustrative host data; the reusable
behavior and contracts ship in packages.

### Viewport navigation

Custom viewport controls consume typed action descriptors from Model. A native
button primitive carries the event, label, disabled and pressed states; the host
owns layout and styling. The minimap exposes the same visible graph and world
bounds used by camera navigation. Its native frame accepts visual styles while
its inner SVG defines pointer coordinates. The camera rectangle is an optional
child so consumers own its placement and paint. Relative keyboard pan events
update the current viewport without editing the graph or creating history.
Both hooks respect the existing visibility and diagnostics gates.

Wheel navigation is a view option. The scoped input binding translates
wheel deltas into the existing viewport pan or zoom events, so the Model
keeps camera ownership and graph history stays separate. An off mode
leaves wheel input to the browser, and canvas help follows the option.

Zoom limits and Fit view padding live in editor preferences so gestures,
toolbar actions, and host camera updates share the same range. Keeping
the range in the view alone would leave programmatic viewport changes and
the pure fit calculation with a different policy. Geometry helpers accept
the same range when called outside the editor.

Animated Fit view is an editor preference. The Model owns the camera
transition and rejects stale frames. The scoped input binding supplies frame
timestamps and the browser's reduced-motion preference. Direct viewport input
interrupts the fit from the current camera position.

Zoom to area extends the same camera contract. The core owns the one-shot
tool, normalized world bounds, and final fit. The scoped FoldKit binding
reuses pointer capture and cancellation, and the optional viewport action
and marquee slot let hosts choose how the tool looks. A distinct gesture
keeps box selection policy and preview highlights out of camera navigation.
Both fits use the existing camera limits, padding, and animation.

Back to previous view stores one camera checkpoint in the editor Model.
Fits and search reveals capture the camera they depart from. Manual
navigation and graph edits leave the checkpoint available, and Back
consumes it. This keeps the action independent of graph undo and snapshot
serialization. A full camera history would also require grouping
continuous gestures, which this single-step return does not need.

### Edge labels

Label hooks render HTML inside Flow's existing positioned frame. The frame
shares the edge geometry policy's anchor and separates label input from canvas
gestures. Public badge, form, input and cancel primitives handle the native
controls while the host owns the contents and styling. A standalone label
positioning API would require callers to duplicate frame and input bindings.
Keeping the frame in Flow also gives both renderers the existing read-only,
draft and undo behavior. Callers can hide a badge independently of editing.

### Scoped theme presets

Typed themes write CSS tokens at the FoldKit view root. This scopes colors
and native control schemes per editor, and the existing class and inherited
variable path remains available. An explicitly supplied token overrides its
class value. The app owns theme selection, so changing modes requires only a
view update and preserves the graph, viewport, and history.

### Connection drop radius

The input binding measures rendered port centers in CSS pixels and sends
nearby candidates in distance order. This uses the host's actual rendered
handles and preserves exact hits. The reducer selects the first candidate
that passes the existing connection policy, keeping eligibility and the
commit independent of the browser.

### Reconnection permission

A host policy evaluates the existing edge and requested end. The native
view uses it to omit handles. The reducer applies it to drag and direct
edits so a stale handle or custom inspector cannot bypass the rule. This
separates endpoint permission from target validation, which still uses
the proposed edge and the existing connection policy.

### World overlay

The view renders host overlay content in the same transformed layer as
the visible graph. This shares the canvas clip and camera projection
without a separate coordinate or DOM lifecycle. The host decides what to
display and owns its messages. The positioning primitive passes pointer
input through by default and uses the existing input exclusion for
interactive items.

### Selected-node toolbar

The view projects the visible node boundary into canvas CSS pixels and
renders the toolbar next to the world layer. Keeping controls outside the
scaled layer preserves their size and avoids inverse transforms in host
renderers. The host chooses placement and contents. Duplicate and delete
reuse the existing selection actions and deletion policy, so toolbar edits
use the same transactions as keyboard and context actions.

### Selected-edge toolbar

The toolbar hook renders inside Flow's positioned screen-space frame. The
frame owns visibility, the accessible group and the connection-list focus
shortcut. The host can compose native action buttons and a path style select,
or dispatch the typed actions through its own controls. Keeping placement in
the frame avoids exposing the viewport and handle-clearance calculation as
part of every custom toolbar. Keyboard entry follows the rendered control
order so a layout can omit Rename.

### Context panels

The context menu hook renders inside a package-owned panel so custom content
shares the scoped input lifecycle, canvas placement, and dismissal. The host
receives typed actions for the current target, including sizing constraints
and diagnostics for groups. The package uses the same native action and
dimension primitives in its default content. Keyboard entry focuses the
first available control in the host layout, including a group dimension
input when it precedes the buttons.

### Connections list

The list hook receives only edges visible in the canvas presentation. Flow
keeps the named group, compact disclosure, and selection state. The host
composes native selection and context buttons inside its own layout. Keeping
the disclosure in Flow gives the renderer the same behavior in standard,
minimal, and read-only views without a second source of expansion state.

### Resize readouts

The readout hook replaces badge content inside Flow's positioned status
region. It receives the current Model node, its formatted dimensions and
whether it is being resized or shown as a selected group. The existing
eligibility and measurement rules run before the hook so custom content
shares the same diagnostics behavior.

### Alignment guides

The guide hook renders decorative SVG in the existing world layer. The
package passes resolved endpoints and viewport without asking the host to
recompute snapping. Effective alignment diagnostics run before the hook,
and the core still owns which guides are active.

### Selection marquee

The marquee hook renders inside a frame positioned with the same world
bounds that the core uses on release. Consumers supply decorative content
without implementing pointer capture, normalization or hit testing. The
frame remains available in minimal mode as active gesture feedback.

### Canvas help and status

Help and status hooks render content within the accessible description
and live region owned by Flow. Hosts can change wording and visual
presentation using the default text and current Model context. Diagnostic
visibility applies to the outer containers so assistive technology can
still read the custom content in minimal mode.

Preview and release use one resolver against the current Model and visible
node bounds. Shells receive a separate highlight flag and the marquee gets
the pending node IDs. This keeps the committed selection, action targets
and pressed states stable during the gesture.
