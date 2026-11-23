# ADR 0126 — Import allowlisted Alchemy infrastructure snapshots

Accepted for local implementation on 2026-11-23.

## Context

The portable Alchemy Domain descriptor documents aggregates and events. The
Teams staging stack represents a different subject. Its resources, bindings and
plan actions are useful during a team architecture review.

## Decision

Export a separate infrastructure v1 snapshot from a trusted in-process Alchemy
2.0.0-beta.85 plan. Copy stack, stage, source revision, logical resource IDs,
types, plan actions, and declared relationships. Emit omissions for unresolved
references. Keep provider inputs, state, credentials, outputs and stack actions
outside the snapshot. Planning is a local operator action. The board consumes
strict JSON and never runs a stack or applies an infrastructure change.

The private adapter projects the snapshot into a detached graph. Teams reuses
its versioned creation request and existing authorization. Editors preview the
snapshot, inspect omissions, and acknowledge losses before creating a new
board. Source metadata and omissions travel in the graph, so a teammate can
inspect them after reopening. The existing Domain descriptor keeps its format.

Running uploaded IaC would move cloud credentials and executable code into the
board service. Importing raw plan state would expose provider inputs and tie the
portable UI to the pinned SDK. A separate allowlisted snapshot preserves the
operator boundary and leaves later snapshot comparison possible.

## Verification

Verify named Worker bindings, dependency direction, unresolved references,
rejection of malformed data and exclusion of provider values. Verify a second
editor can reopen the created board and see its declared binding and source
revision. Qualification does not apply the Alchemy plan.
