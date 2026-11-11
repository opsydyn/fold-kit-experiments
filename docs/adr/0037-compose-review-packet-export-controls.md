# ADR 0037: Compose review-packet export controls in the optional adapter

## Status

Accepted for the approved roadmap continuation, 2026-11-11.
Boundary review: safe with noted risk. Preview materializes authored snapshot data
in memory; consent is a local interaction guard, not a security credential.

## Context and decision

ADR-0035 owns packet composition in the optional Mermaid adapter. ADR-0034 owns
independent audit baseline/target selection. Add pure export context/request
resolvers beside the builder and unstyled, composable native controls at
`@opsydyn/foldkit-zloz-mermaid/foldkit`. Core must not import its adapter. The root
entry remains free of Foldkit, Effect, browser APIs and I/O. Foldkit is an optional
peer; the optional view entry imports only Foldkit types.

Preview always uses report mode in memory so users can inspect both sides' losses.
A download requires explicit loss consent bound to the exact canonical packet
JSON. A fresh resolution rebuilds and compares that content before authorizing a
Command; model/selection/snapshot/camera/convention/projection changes invalidate
old requests and consent. Unrelated editions do not invalidate a selected-snapshot
packet. Host session identity and live busy protection are checked independently.
Projection errors never produce a download. Authored data and cameras stay in JSON;
loss disclosure describes the Mermaid projections, not corruption of the model.

The workbench consumes chosen audit IDs, previews only in History, retains consent
in the Foldkit model and downloads JSON through a Command. Counts respect existing
diagnostics and minimal mode; functional scope, losses and protection stay readable.
All UI parts have nullable/custom renderers and layout/attribute seams. Native
labels, keyboard interaction and disabled reasons are defaults, not a closed style.

## Alternatives and consequences

An app-only panel would not ship a reusable contract. Core importing Mermaid would
create a dependency cycle. A host revision token alone would miss camera/convention
changes; a lossy hash could collide. Exact serialized content costs packet-sized
memory and repeated pure projection while History is open, but makes freshness
independent of host bookkeeping. This is not a performance or cryptographic claim.
A later cache must preserve identical freshness semantics.

No document/protocol migration, packet import, new package, collaboration, agent
execution, publication or deployment. Remove the additive controls to roll back;
existing packet/CLI behavior remains unchanged.

## Implementation and verification

- Adapter: pure controls, optional view exports/build metadata and public docs.
- Test first: consent, changed source/camera/rules/selection, missing IDs, errors,
  host blocks, count-free/custom rendering and headless/optional packed consumers.
- Workbench: model/fact messages/update, History composition and download Command;
  verify working graph/Undo preservation and stale-session rejection.
- Capture light/dark browser downloads, keyboard consent, diagnostics/minimal mode
  and downloaded packet identity against the chosen sources.
- Run root check/typecheck/tests, API docs and workbench build sequentially.
  Architecture, delivery and test quality review are self-review.
