# ADR 0072: Measure rendered labels with scoped freshness

## Status

Accepted for the approved opt-in measured-label slice, 2026-11-13.
Architecture, boundary, delivery and test-quality reviews are **self-review**.

## Decision

Core owns a transient `ZlozLabelMeasurements` union: idle, pending, ready or failed.
`startLabelMeasurement` captures a fresh caller request ID, editor revision, exact
serialized graph snapshot, caller render key and unique existing edge IDs. By
default it requests all edges; callers can request a rendered subset. It copies
IDs, validates identity and never edits the graph. `updateLabelMeasurements` ignores
old completions before examining payloads, then validates the complete batch:
every requested edge once, positive finite dimensions, detached size records.
No partial batch is usable. `resolveLabelMeasurements` checks freshness again
before supplying `edgeLabels` to an ordinary layout request. Gesture/editing state,
source changes (even at the same revision), renderer changes and old request IDs
cannot publish or reuse bounds. Cancelling replaces the union with idle; a new run
uses a new ID. This is a typed contract, not a raw-data decoder or trusted proof.

The Foldkit adapter offers `zlozView.labelMeasurement` and a composable
`zlozLabelMeasurement` probe for custom hosts. A single keyed probe Mount lives
inside the measurement scope; labels are scoped targets with edge IDs. Measurement
is absent by default. The Mount waits for used-font readiness, then observes all
requested HTML label border boxes once. It accepts fractional CSS dimensions,
maps vertical writing modes to physical width/height and does not divide screen
rectangles by a captured zoom. Observer dimensions remain in world/CSS units.
See [borderBoxSize](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/borderBoxSize)
and [font readiness](https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts).
Nested measurement scopes are isolated. Missing, duplicate, fragmented, zero-sized,
nonpositive or unsupported targets report explicit failure. The default deadline
is 3000ms; consumers can set a finite positive `timeoutMs` up to 60000ms. Font
failure/timeout cannot hang a request. Mount cleanup disconnects the observer,
cancels the timer and suppresses late callbacks, including after font resolution.
The probe is inert for SSR; native APIs are used only inside the Mount effect.

The host owns renderer identity: its render key must cover all size-affecting
content, theme, font, selection and renderer options. Core cannot infer arbitrary
CSS or custom renderer state. It owns no DOM, browser or Effect dependency. No
mutation of the graph, provenance, persistence or layout wire formats is added.
Observers/timers are local effect resources, never external application state.

## Workbench and publication boundary

Domain review keeps declared 176 by 36 bounds as the default. Users may select
measured badges, compact/expanded source details, Measure/Cancel and then Arrange.
The measured renderer has intrinsic width/height, text and a source/DDD tag. There
is no automatic arrangement, continuous observation or hidden layout loop.
Mode/detail changes invalidate measurements and layout. The render key includes
actual color scheme; late theme changes block both measurement publication and
layout publication. The host rechecks core's resolver on engine completion.
Successful layout advances revision, so another arrangement needs a fresh batch.
The status distinguishes successful consumption from an unrelated stale renderer.
Arrange exposes `aria-disabled` with its reason when bounds are unavailable,
retains focus after completion, and its reducer rejects activation without valid
bounds. Read-only preview/source/findings and working model/Undo stay separate.

## Alternatives, limitations and rollback

Continuous ResizeObserver-driven auto-layout would entangle render and layout,
invite feedback loops and create extra Undo/selection obligations. A per-label
stream would leave partial collections waiting for omitted renderers. Screen
rectangle division by old zoom would accept incorrect dimensions after delayed
font loading and camera changes. The selected batch Mount uses existing lifecycle
ownership and explicit core state without new dependencies.

Only a single rendered HTML border box is measured. Margins, shadows, overflow,
local CSS transforms, portals, SVG targets and future image/font changes are not
inferred. Wait for other content resources and remeasure or bump the render key.
Render every requested target (disable culling or request a visible subset).
Missing targets fail, rather than returning fabricated zero sizes. These are
transient observations; graph serialization and authored SVG/PNG fidelity remain
unchanged. Source/SDK compatibility, publication, provider and hosted gates remain.
Reverting the local commit rolls back this additive contract; nothing is deployed.

## Acceptance

Test complete/invalid batches, cancellation, replacement, stale revision and
same-revision source changes, render-key changes and detached results. Exercise
native-boundary font delay, timeout, nested scope, fractional/vertical sizes and
idempotent cleanup; SSR default/opt-in hooks and deadline validation; workbench
Measure-to-Arrange and renderer changes during actual ELK completion. Install real
tarballs for strict runtime/type qualification. Browser-check actual intrinsic
badges, keyboard focus, Cancel/content replacement during a delayed browser font
boundary, zoom independence, light/dark/Minimal mode and working-model equality.
Inspect captures. Run root typecheck, check, all tests and production build.
