# ADR 0026: Compose package-owned playback controls

## Status

Accepted for the approved composable transport slice, 2026-11-09.
Boundary review: **safe with noted risk**. Availability is a view projection;
host updates retain live policy, clock and lifecycle authority.

## Decision

Add a pure core resolver deriving named playback actions, disabled reasons,
current edition and status text. Host restrictions add vetoes: a whole-navigation
restriction affects play/manual navigation, while an automatic-only restriction
can express visibility or preference readiness. Neither can remove core reduced-
motion/boundary guards. Pause always remains available while playing. Normalize
blank denials and label fallbacks to avoid unexplained disabled controls.

The optional Foldkit entry provides unstyled native control/status/reason helpers
and a named-group composition. Slots replace or omit controls, status and reasons;
an ordered subset and layout hook control composition. Native helpers retain
button type, accessible names, disabled state, reason descriptions and polite
status semantics. Engineers may also compose the individual helpers without the
default frame. No CSS overrides, timer, mutable state or generated DOM IDs are
required. Custom renderers remain responsible for their own semantics when they
replace the native helpers.

The workbench consumes the same resolver/helpers and demonstrates a custom badge,
pill controls and layout. It continues to validate actions in update, own the
subscription generation and stop playback on manual inspection/lifecycle changes.
Existing playback API, reduced-motion behavior, ghost controls and portable
formats are unchanged. Interval selection remains host-owned in this slice.

## Alternatives and consequences

An app-only toolbar keeps product behavior unavailable to package consumers.
Embedding the timer in the view creates lifecycle coupling. A generic toolbar
framework would exceed this bounded control contract. These controls describe
availability but do not confer permission or replace current update guards.
Localizing names uses labels/slots; consumers can supply custom status/reason
content through native helpers. No dependencies, publication or deployment.
Reviews are self-review; rollback is a code revert with no persisted-data impact.
