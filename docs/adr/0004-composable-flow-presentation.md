# ADR 0004: Make Flow presentation composable through public contracts

## Status

Proposed following the user's 2026-11-05 clarification: freedom and control apply
to the engineering API, so a designer's vision must be achievable through supported
composition rather than private implementation copies or CSS overrides.

The principle is agreed; the detailed extension API and implementation below are
proposed. This review does not claim that the current renderer already meets it.

## Context and current evidence

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

## Decision proposed

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

## Verification of this review

This change records the audit and proposed contract. It adds no renderer hooks,
geometry policies, styling switches or runtime behavior. Existing package feature
qualification does not prove the proposed customization surface.
