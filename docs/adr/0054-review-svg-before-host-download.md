# ADR 0054: Review SVG before host download

## Status and scope

Accepted for the approved package controls and workbench slice, 2026-11-12.
Extends [ADR 0053](0053-write-svg-through-typed-primitives.md). Architecture,
boundary, delivery and test-quality reviews are self-review: safe with noted risk.
PNG, resource-byte embedding, Alchemy and publication remain outside scope.

## Decision

Core owns a pure review controller: `createSvgReview`, `svgReviewForScope`,
`resolveSvgReview` and `updateSvgReview`. The optional `/foldkit` entry owns native
and composable settings, preview, findings, acceptance and download controls.
Browser IO stays in a host Command, receiving only the freshly validated SVG bytes
and filename. The graph, camera, history and Undo are untouched.

Review projects the writer's complete final findings, including losses. A written
candidate is available for review before acceptance; unsupported output never
produces a download payload. Consent binds to the exact serialized source,
source revision, options, filename, final bytes and findings. Hosts must advance
`sourceRevision` on edits and Undo, or supply a unique immutable snapshot identity.
Settings advance a generation; model incarnations use a new scope. Whole-model
camera motion is irrelevant; viewport camera and surface changes invalidate consent.
Adapter output changes invalidate consent even under unchanged adapter IDs.

Loss acceptance is content approval, separate from live permission. A protection
reason disables download while retaining consent to unchanged content. Every
request rechecks the current artifact and live policy. Keys are full exact strings,
not security tokens. This host workflow gate is not data access control: reviewing
already exposes the model and SVG to the host. Pure synchronous callbacks remain
trusted host code. Repeated writing/serialization costs on large graphs are unqualified.

Pending jobs have scope, generation, artifact key and run identities. Only matching
callbacks settle them; old callbacks cannot clear newer jobs or publish obsolete
success feedback. Changing source does not cancel an already handed-off browser
save. UI success says “handed off”, not that an OS save completed.

Native controls expose labeled choices for model, viewport and configured bounds,
themes and backgrounds. Missing choices and unmeasured viewports have visible
reasons. Custom slots can replace every region or layout; package helpers preserve
disabled and request semantics. The thumbnail is an inert image data URI of the
exact SVG, with no raw markup injection. Minimal diagnostics suppress explanatory
instructions and numeric readouts, retaining findings, acceptance and actions.

The workbench adds one lazy left-sidebar section, portable light/dark palettes,
custom finding cards and a styled package download helper. Literal export palettes
are explicit; no claim is made to capture live host CSS or custom DOM shells.

## Alternatives and verification

Host-only controls would duplicate consent rules and fail the reusable-package goal.
DOM screenshots would lose the existing portable writer boundary. Durable graph
consent would introduce unrelated schema/history state; review is ephemeral instead.
Rollback is a local revert with no document migration.

Tests cover exact approval, stale source/settings/adapter output, policy protection,
viewport/configured bounds, old completions, native/custom/minimal views, packed
Node/Bun consumers and receipt-mode completion. Chromium evidence checks actual
file bytes against preview, crop/transparency, edit then Undo invalidation, light/dark
and canvas visibility. See [qualification](../../apps/zloz-demo/evidence/svg-review.md).
Font substitution, ink bounds, broader browsers, manual AT and large-model cost
remain unqualified. Recommended follow-up, needing review: define validated embedded
font resources before broader typography fidelity claims. PNG and Alchemy stay deferred.
