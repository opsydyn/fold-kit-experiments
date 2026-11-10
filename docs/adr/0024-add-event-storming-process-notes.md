# ADR 0024: Add event-storming process notes

## Status

Accepted for the approved semantic primitive/rendering/starter slice, 2026-11-09.
Boundary review: **safe with noted risk**. Workshop process vocabulary remains
independent of structural DDD and C4 roles and of executable workflow behavior.

## Decision

Extend `ZlozNodeArchitecture` with a separate `event-storming` family: command,
domain-event, policy and actor, with optional description. Use existing authored
outline geometry and ordinary ports/edges. These are notes, not group boundaries;
they may be members of existing groups. Reject unknown roles and reserved fields.
Keep core dependency-free and keep node payloads host-owned.

Ship a composable native Foldkit note renderer with visible type/name/description,
optional body caching, live native sockets/controls, and replaceable content and
control slots. Scoped light/dark theme tokens set role accents; color alone never
carries role meaning. Appearance/geometry remain independent of semantics.

Extend the existing pattern factory with an illustrative process: actor, command,
event, policy, follow-up command. Existing insertion handles IDs, live policies
and atomic Undo; do not build another insertion engine or implicit causality rules.
The workbench offers additive insertion, an example and explicit renderer choice,
composes all three semantic families, and preserves visual mode on insertion.

Graph/snapshot/model envelopes remain version one with additive semantic values.
Older cores can reject the unfamiliar family; no silent downgrade is promised.
Existing C4/DDD documents keep their meanings. Mermaid's existing strict/report
loss contract must disclose omitted architecture metadata for these notes too.
History and Undo use existing graph contracts; no process engine is introduced.

## Alternatives, limits and sources

Putting commands/policies in structural DDD roles conflates process notes with
structural concepts. An app-only palette denies package users the same contract.
A universal renderer refactor would expand this slice; reuse existing native
composition/geometry/cache boundaries directly. Palette search, new geometric
outlines, full workshop vocabulary, semantic relationship constraints,
collaboration and executable policies are later work. No dependency, publication
or deployment change. Rollback is a code revert; preserve exported notes if
consuming them with an older core. Reviews are self-review.

[EventStorming's own introduction](https://www.eventstorming.com/) describes a
flexible collaborative exploration format with multiple workshop styles. This is
a bounded toolkit vocabulary, not a claim of complete methodology coverage or a
prescribed workshop color standard.
