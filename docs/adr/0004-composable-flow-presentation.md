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

Double-click zoom is a separate opt-in view option. The scoped input
binding recognizes two ordinary background presses and sends the existing
`Zoomed` event. Reusing this event gives double-clicks the same anchor,
limits, and fit interruption behavior as other zoom gestures. Gesture
recognition stays in the binding because it depends on native click
sequence and pointer capture.

Space-drag is an opt-in view shortcut for a focused canvas. The scoped
binding samples the held key and uses the existing pan gesture for a
background drag. The current canvas tool stays in the Model. Reusing
the existing gesture gives Space-drag the same camera and pointer
cancellation rules without changing graph history.

Middle-drag uses the same pan gesture through a separate opt-in view
option. The input binding owns the button and capture lifetime and
reserves the gesture for the canvas background. Links and controls keep
native auxiliary clicks. The existing camera state and tool selection
stay in the Model.

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

### Port editing

Keyboard target selection is an atomic core action, independent of pointer
gestures. The pure selector reuses validated permitted guide targets,
excludes continuous edges, and orders point kinds by current priority with
canonical ordering within each. Next/previous wrap; off-target entry uses
the first/last point. Explicit first/last actions make endpoints predictable.
The result is an empty union case or a detached target with index/count.

Each editor action resolves current per-port rules after checking edit
permission, then reuses the existing position transaction. Matching anchors
preserve representation/history; empty sets report a named notice without
editing. Different positions commit once, retaining wiring and routing
direction. Current permission, visibility, read-only and active-gesture
guards remain authoritative. No keyboard cursor or external state is stored.

Native Page Down/Up and Home/End mappings are opt-in on focused anchor
handles. Modified keys, repeats, editable fields, disabled controls and
pointer capture are guarded in the input resource. Arrows retain exact
nudging; Tab remains native. Handle contexts expose the mapping for custom
help and native primitives supply shortcut metadata. Named target feedback
uses the existing status region and diagnostic behavior.

This is preferred over remapping arrow nudges or simulating pointer drags,
which would change precision and capture semantics. Related first/last,
empty/singleton, focus and feedback work belongs in the same slice because
it completes the keyboard interaction. Verification covers ordered/filtered
selection, wrap, fresh policies, atomic Undo, no-op representation, guards,
native scoping/repeats/modifiers/cleanup, focus retention and Tab exit in the
workbench. Hosts retain the typed action and helper for their own controls.

Point-target priority is an optional core setting: corners first preserves
the existing behavior, while midpoints first reverses only the two point
kinds. Edges remain the final fallback. A preferred kind must pass its
existing enabled/allowed/radius/retention rules; its eligible result wins
over a lower kind, including a retained lower-kind target. Within-kind
hysteresis and routing-hint ties are unchanged.

The editor owns an idle-only preference, and the per-port policy can
override it. Both flow through the existing detached settings capture.
Omission inherits the editor preference, with implicit corners-first for
older records. Constructor/helper/resolver inputs validate the two-value
union; invalid preference facts are ignored. Bypass uses the captured order
on fresh acquisition, and permission/history checks remain authoritative.
Guide enumeration keeps canonical order; active feedback identifies the
resolved winner, and renderers can read the captured priority.

This is preferred over ranking target kinds by raw distance, which would
change existing snap behavior, and over arbitrary priority arrays, which
would allow edge attraction to eclipse point targets and require more
policy validation. Verification covers both overlap winners, fallback and
filtering, lower-kind retention, within-kind stability, zoom, invalid values,
global/per-port capture, bypass, policy rollback, guides and Undo/Redo.
The workbench's overlap example gives Review input the selected priority
and fixes Review output to corners-first, exposing a per-port override.

Permitted-target guides are an opt-in presentation layer for an active
anchor gesture. The pure guide enumerator validates captured settings and
shares canonical corner/midpoint coordinates with the snap resolver. It
includes only positive-radius, permitted targets, independent of pointer
distance. Views resolve these normalized targets into current world bounds
and expose active attraction, viewport and detached settings to custom SVG
renderers. A native primitive retains geometry while allowing custom paint.

The package owns an aria-hidden, inert, pointer-transparent overlay above
node paint and below anchor handles. Custom SVG cannot become an editing
surface. Undefined uses native geometry; null omits one guide. Alignment
diagnostics, global diagnostics, minimal mode, bypass, read-only state,
current edit protection and visible-node membership gate hooks first.
Release/cancellation removes the overlay. No policy callback is repeated
and no state or history is introduced by viewing guides.

This extends the existing alignment diagnostic category instead of adding
another global flag; the independent view opt-in still controls port guides.
It is preferred over workbench-only SVG and over reading the host policy
again in view, which would duplicate target geometry and risk disagreement
with captured rules. Verification covers normalized enumeration, world
geometry, native/custom fallback and omission, constant screen sizing,
diagnostic/bypass gates, inertness and unchanged graph/history. The sample
offers native guides and a custom crosshair style through the public helper.

Allowed snap targets extend the existing per-port settings with optional
edge, corner and midpoint lists. Missing lists preserve unrestricted
attraction; empty lists disable one kind with no radius change. A supplied
list replaces the inherited list in the settings helper. The core validates
names and array shape, normalizes duplicates into canonical order, then
filters candidates before nearest selection and hysteresis. This preserves
existing target priority and tie-breaking and prevents a forbidden previous
target from remaining retained. Empty candidate sets return free placement.

Lists are copied at settings resolution, drag start and active renderer
feedback. Host mutation cannot change a running drag. The existing gesture
captures them without browser-owned state, a second callback evaluation or
new document fields. They restrict attraction only; clamping, exact edits,
free placement, bypass, current edit permission and history stay unchanged.

This is preferred over separate booleans for each target, which duplicate
the target vocabulary, and post-snap vetoes, which can discard a forbidden
nearest target without considering another allowed candidate. The workbench
adds an independent, idle-only demo toggle: Review input attracts left/right
midpoints, while Review output attracts its top edge and upper corners.
Other ports keep their current policy. Verification covers filtering and
retention, empty/inherited lists, validation, canonical ties, zoom, detached
capture/feedback, bypass, protection and Undo/Redo. Browser evidence checks
permitted and forbidden targets on both ports plus normal free placement.

Per-port snapping extends `EditorPolicy` with the pure `portAnchorSnap`
callback. Its current node/port/graph context resolves partial edge,
corner, midpoint and hysteresis values. Absent fields inherit editor
preferences; explicit zero disables one rule. The public settings resolver
validates finite non-negative effective values and returns a detached
record. Invalid settings throw `FlowError` before a gesture starts, matching
the core's existing invalid-configuration behavior.

The Model captures all effective values in `gesture.snapSettings` at an
allowed pointer-down. This prevents mutable host profiles and policy
changes from altering a running gesture, including stationary modifier
transitions. Next-drag settings reflect the current policy. Edit permission
still rechecks against the current policy on preview/release. Older gesture
records without captured preferences fall back to global editor settings.
Active handle contexts receive a detached settings copy; idle handles do
not evaluate the callback. The view needs no parallel policy option.

This is preferred over adding snap preferences to serialized port data,
which would couple session behavior to graph migrations, and over resolving
the callback on every preview, which would allow mid-drag rule changes.
It adds a callback contract but reuses the existing snap resolver,
priority, bypass and history boundary. The workbench owns only its opt-in
demo flag and example callback. Tests cover inheritance/zero/validation,
multiple ports and nodes, detached capture, changing policies, permission
rollback, modifier transitions, exact edits, serialization and composable
feedback. Browser evidence checks midpoint-only, corner-only, free and
inherited ports, zoom, bypass, cancellation and one-step Undo/Redo.

Edge-midpoint attraction adds an independent, zero-default
`portAnchorMidpointSnapDistance`. The pure resolver measures circular CSS
distance to the four exact edge centers using the same discrete-point
retention calculation as corners. Priority is corners, then midpoints,
then edges. This preserves corner precedence even when radii overlap on
small nodes, while midpoint attraction overrides retained edges. The
routing hint breaks midpoint acquisition ties before left/right/top/bottom;
corner tie order stays unchanged. Shared hysteresis governs retention and
switching within a target kind. Leaving its band permits fresh acquisition
in lower-priority modes.

The optional midpoint result and `snappedMidpoint` context use `PortSide`
for naming, with `side: null` during midpoint attraction. Identity and the
authored routing hint remain unchanged. The existing Model gesture stores
the retained midpoint; bypass clears all three target kinds. Native handle
descriptions/markers and a workbench badge compose through the public
helper. Options and idle-only preference facts stay out of graph snapshots.

Reusing the resolver and transaction is preferred over workbench-only math
or snapping along just one axis, which would fail exact centered placement.
An independent radius permits midpoint-only editors and preserves existing
defaults. Verification extends pure geometry, reducer and renderer tests
for four midpoints, radial thresholds/zoom, ties, retention, precedence,
bypass, policy rollback and history. Browser evidence covers the custom
badge, precise release and normal cancellation. No new dependencies or
input resource state are required.

Corner attraction extends the existing pure anchor resolver and gesture,
using an independent `portAnchorCornerSnapDistance` preference (zero by
default). The circular radius uses clamped candidate coordinates and CSS
pixels, preserving behavior at any zoom. Eligible corners take priority
over edges. A positive shared hysteresis margin retains a corner through
its release band and requires a competing corner to win by more than the
margin. On release from the band, edges use normal acquisition. Stable
corner ties follow top-left, top-right, bottom-left, bottom-right.

The result and renderer context expose the corner separately from the
edge; corner snaps have no attracted side and never change the authored
routing hint. Bypass clears both retention kinds. The package retains the
same policy rechecks, no-motion behavior and one-history-entry release.
This is preferred over host-only snapping, which would duplicate geometry
and history rules, and over implicit two-axis edge snapping, which would
change existing behavior when corner attraction was not requested. An
independent radius costs one preference but permits corner-only editors.

Implementation extends core options/events, resolver and gesture feedback,
then the native handle and workbench control using the existing public
composition helper. No dependencies or graph format fields are added.
Verification covers radial/zoom thresholds, independent defaults,
retention/switching, edge fallback, modifier-only previews, Undo/Redo,
policy rollback, cancellation and custom rendering. The workbench browser
probe captures a custom corner badge and checks precise bypass release.

Temporary snap bypass is gesture state. The Model retains the last raw
pointer sample so modifier-only facts can recompute preview geometry.
Bypass disables attraction and clears retention while preserving clamping,
policy checks and a single history boundary. Restoring snapping performs
fresh acquisition. The optional native modifier mapping is captured at
pointer-down; the input resource stores capture/configuration state, not
document coordinates. Headless events expose the same behavior. This
keeps temporary precision separate from the host's saved snap preferences
and supplies renderer feedback without a second state store.

Anchor hysteresis is an optional core preference. The resolver consumes
the gesture's previous attracted side, retains it within an expanded
release band, and requires a competing edge to win by more than the same
screen-pixel margin. New acquisition still uses the original radius.
This keeps the state and calculation replayable at any zoom level. A
zero default preserves nearest-edge behavior; idle-only preference edits
preserve the gesture's configuration. The existing preview, policy and
history boundary stays authoritative, and no additional document fields
or browser-owned retention state are introduced.

Edge attraction is an optional core session preference, not a DOM-only
heuristic. The pure resolver compares frame-edge distances in CSS pixels,
using node dimensions and viewport zoom. Pointer previews use the nearest
eligible edge and expose it on the gesture and renderer context. The
routing hint stays stable, preserving wiring geometry intent and handle
offsets. Exact ties prefer that hint, then a fixed edge order. A zero
default and exact keyboard/numeric edits retain free authoring. Idle-only
preference changes avoid altering gesture behavior mid-drag; existing
policy, rollback and history boundaries remain authoritative. This bounded
choice adds nearest-edge attraction without corner magnets or hysteresis.

Anchor dragging is a core gesture with its original graph and screen-space
pointer origin in the Model. Moves preview normalized frame coordinates;
release records one history entry. Cancellation and live policy vetoes
restore the original port, including offset representation. Measurement
updates also update the saved graph so rollback retains fresh dimensions.
Separate opt-in handles live in the world layer, preserving socket wiring
and custom node shells. A renderer and native primitive keep presentation
composable. Keyboard nudges reuse the existing position transaction. This
adds one bounded gesture rather than co-opting connection drag or storing
document state in the browser input resource.

Position authoring uses a discriminated text draft in the FoldKit adapter,
with offset and anchor modes. Partial text stays outside the document;
an Option-returning parser validates active fractions before a single
`PortPositionsChanged` transaction. Native input primitives project the
existing position capability and share reason links. This reuses the core
edit and Undo boundary without introducing field-by-field document events
or per-keystroke history. Mode conversion preserves the along-edge value
and projects to the selected edge when returning from X/Y coordinates.
Hosts own draft lifecycle and retain full layout and copy control.

Inspector presentation lives in the optional FoldKit adapter. Option-based
context factories resolve operation capabilities, guard copy and scoped
reason IDs; equal reasons share one rendered description per entry.
Native primitives bind host drafts, Save/Cancel, and atomic removal.
The host composes layout and content rather than configuring a monolithic
inspector widget. Addition deliberately emits a host message, allowing ID
allocation against the latest Model during rapid input. Contexts are
preflight views; the existing core reducer remains the commit authority.
This adds reusable controls without moving draft state into the core or
introducing an Astro dependency. Hosts still manage draft lifecycle and
must pass their current policy when committing.

`canEditPort` authorizes individual direct port operations using a
`PortEditCandidate` (operation, node, and current port; proposed port for
addition). This capability check stays independent of proposed display
text or coordinates so a host can preflight an editor without guessing
its future draft. The reducer rechecks current policy on submission.
The public `portEditReason` normalizes the reason for host controls.
Removal combines port protection with the existing complete edge-deletion
check; position batches authorize every changed port before one commit.
Keeping this separate from connection and aggregate deletion policies
lets a port remain usable for wiring while its authored shape is managed.
The additional callback is optional, preserving existing behavior.

Port display text changes through `PortLabelChanged`, within the same
validated document transaction. Clearing a label removes the optional
field; endpoint identity and wiring do not change. Draft interaction
belongs to the host, which submits one event on Save. This reuses the
existing transaction boundary without adding inspector state to the core
or rewriting endpoint IDs to match display text. The cost is that hosts
must manage their own draft lifecycle; the sample cancels drafts when
the document changes or their node leaves the selection.

Port add/remove events use the existing document transaction boundary.
Addition validates and detaches the authored port. Removal resolves all
attached edges against the existing deletion policy before publishing the
port and edge changes together. An exported resolver gives host controls
the same decision. The host supplies identities and placement. Existing
graph serialization already represents these ports, so the operation
requires no document format change.

### Port handles

A port renderer receives the node context, canonical normalized anchor,
port label, active and target state, and the host policy's disabled reason.
It composes the existing native port primitive. Resolved controls are
available to custom node and group shells as direct frame children.
Undefined retains the standard renderer and null omits an individual
control. The reducer retains connection authorization. Custom port
rendering uses the normal view path because the built-in retained-node
slot has no custom renderer state in its cache contract.

### Port labels

Port labels render in the existing world layer, using canonical anchors
from the visible nodes. Keeping this layer outside measured shells
preserves node sizing and custom shell composition. A public decorative
frame owns positioning, pointer passthrough and accessible hiding. The
renderer can compose that frame with its own content and per-port
placement. Visibility and culling follow the node presentation.
Labels are opt-in semantic content and remain available in minimal mode.

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

The view can set a separate reconnection radius. An omitted override
inherits the connection radius, and an explicit zero requires an exact
hit. The binding selects the radius for the current gesture and uses the
same candidate and policy path for both operations.

Snap hysteresis is an editor preference in CSS pixels. Native input adds
an optional measured distance to each nearby endpoint, preserving
endpoint-only messages from custom adapters. The reducer keeps the
current eligible target until an eligible challenger wins by more than
the configured margin. It considers exact hits first and releases targets
that leave the radius. Selection stays in the Model so rapid pointer
events do not depend on a rendered DOM attribute or a second target store.

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

### Endpoint chooser extraction (2026-11-07)

Accepted following approval of the
[keyboard connection review](../assessments/2026-11-07-foldkit-flow-keyboard-connections.md).
The core owns `resolveEdgeReconnection` and typed candidate contexts. Shared
`connection-validation.ts` supplies candidate and commit checks. The FoldKit
adapter owns unstyled native select, visible-reason and field primitives, plus
an opt-in `edgeReconnection` toolbar configuration. Astro composes those APIs;
it no longer enumerates or validates reconnection candidates.

The alternative of extracting only the host select leaves eligibility rules
duplicated. A new keyboard drag mode adds gesture state and cancellation rules
without being necessary for endpoint selection. Reusing `EdgeReconnected` keeps
history, metadata preservation and commit-time permission checks in one path.
No dependency or persisted schema change is needed. The expanded toolbar uses
`src/edge-toolbar-placement.ts` to reserve a scrollable vertical band clear of
reconnect handles rather than allowing new controls to occlude pointer editing.

Visible alternatives are the default; current hidden endpoints remain labeled
and an explicit `scope: 'all'` permits broader host inspectors. This may exclude
ports that the old Astro inspector displayed, so document that migration rather
than silently broadening native canvas behavior. Native options accept text;
rich custom widgets consume the same headless entries and own their widget
semantics. Candidate evaluation invokes pure policies once per proposal and is
not a permission token for future commits.

Implementation and verification:

- [x] Add the pure resolver in `src/edge-reconnection.ts`, export it from the core,
      and share validation with `src/editor.ts` without importing view dependencies.
- [x] Add `src/edge-endpoint.ts` and opt-in toolbar contexts/controls in
      `src/foldkit.ts` and `src/edge-toolbar.ts`; preserve default toolbar behavior.
- [x] Replace the local workbench selector with native package primitives and
      custom markup in `apps/flow-sample/src/editor/view.ts`.
- [x] Qualify fresh/stale policy rejection, hidden/absent/current endpoints,
      identity stability, one-step Undo/Redo and preserved metadata in
      `test/edge-endpoint.test.ts`; verify native keyboard/focus in Chromium and
      compile a packed consumer. Run root check, typecheck and all tests.

All `src/` and `test/` paths here are relative to `packages/foldkit-flow/`.
Formal screen-reader/device qualification and new canvas keyboard gestures remain
separate slices. This extension follows the existing four-layer boundary and
does not replace it.
