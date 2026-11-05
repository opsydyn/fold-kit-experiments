# ADR 0004: Make Flow presentation composable through public contracts

## Status

Accepted for node/group composition, shared edge geometry and connection previews on
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
