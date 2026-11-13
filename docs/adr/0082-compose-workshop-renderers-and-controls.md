# ADR 0082: Compose workshop renderers and controls

## Status

Accepted for the approved renderer/control/workbench slice, 2026-11-13. Builds on
ADR 0081. Architecture/boundary, delivery and test-quality reviews are self-review.

## Decision

Extend optional FoldKit note rendering to external systems and hotspots; add
`zlozEventStormingGroup` for lane frames. Preserve native authored geometry,
selection/drag/resize/socket policies and portless annotations/frames. Share
content replacement/omission slots, inert body caching, optional group-header
geometry and separately live controls. Add a replaceable/omittable hotspot status
slot and scoped theme tokens for external, open/resolved hotspot and lane accents.
Status text is semantic content, independent of diagnostics/count visibility.

Core resolves pure workshop edit controls and live requests into existing
NodeArchitectureChanged events. Expose compatible role choices and hotspot status,
including visible kind/port/policy protection reasons. Preserve descriptions when
switching role/status. Scope requests to node/revision/descriptor; reject stale,
unselected, hidden, busy or read-only targets and re-evaluate live policy before
returning an event. The host applies ready events immediately through updateEditor
with the same policy. No Apply authority, implicit kind/port change or special Undo
stack is created. Shared port-add capabilities reject portless annotations/frames
without creating an invalid graph; the demo omits those inapplicable port actions.
Lane collapse/drag/resize remain native group controls.

Provide unstyled composable selector/status/reason/layout primitives. Default
hotspot status uses explicit Open/Resolved native pressed buttons, with a public
button primitive; the select helper remains available for custom compositions. Hosts may
replace or omit controls and artwork without bypassing core policies. Add a pure
workshop starter factory; Astro composes public controls/renderers and the existing
opt-in workshop catalogue in a left-sidebar example. Demonstrate protected edits,
custom badges, keyboard interaction, light/dark, diagnostic preferences and Undo.

## Boundaries and alternatives

Host-only artwork or status mutation would hide reusable functionality in Astro.
A new editable annotation store or custom mutation path duplicates the existing
node/editor lifecycle. Reusing composition and existing editor events keeps graph
truth and history in core. UI peers remain optional; no new dependencies.

This qualifies native FoldKit artwork and interactions, not SVG/PNG artwork fidelity.
The existing explicit portable-export guard/adapters remain until that separately
qualified work is approved. Legacy causal defaults/portable packets and all wire
formats stay unchanged. No C4 conversion, new rules, automatic layout, attachment
references, publication, deployment or provider activation.

## Implementation and acceptance

- Tests first for live status/role policies, descriptor freshness, port/kind reasons,
  selection/visibility, no-op/read-only/busy behavior, one Undo and description preservation.
- Native/custom/omitted FoldKit content and controls, live sockets/cache behavior,
  status text independent of diagnostics, lane collapse and header geometry.
- Real packed consumers and existing legacy conventions/export regressions.
- Workbench typed requests scoped by model/epoch, opt-in convention, editable and
  protected hotspots, native groups, custom status badge and retained read-only history.
- Production build and Chromium keyboard/light/dark/diagnostics/Undo evidence.
- Full check/typecheck/tests, API docs, roadmap and evidence receipt before commit.

Rollback before release is a revert/rebuild. Authored descriptors and history formats
are unchanged. Revisit first-class portable artwork through the existing SVG adapter
and fidelity boundary, rather than weakening its unsupported guard.
