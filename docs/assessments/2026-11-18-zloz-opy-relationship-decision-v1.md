# OPY shared relationship decision v1

## Decision and boundary

Milestone 1 froze the versioned contract and the write-path test. Milestone 2 adds the local authenticated write path and the Teams inspector. The diagram aggregate owns decisions and their relationship binding. Checking the binding and appending an acceptance happen in one aggregate command. Edge metadata would tie decision history to graph deletion and Undo. A D1 decision write would split the evidence check and acceptance across stores.

The first pilot records one decision on an existing relationship. A share, acceptance or withdrawal leaves the graph, graph version, graph coverage and Undo journal intact. Full-frame readers receive an optional `relationshipDecisions` array. An absent array means decision support is unadvertised. An enabled diagram can return an empty array. Existing graph exports and graph checkpoints retain their v1 shape. The [literal fixture](../../packages/foldkit-zloz-alchemy/test/fixtures/relationship-decision-v1.json) pins the request, record, accepted event and compatibility examples.

## Commands and records

The private Teams proxy exposes `POST /api/zloz/diagrams/{teamId}/{diagramId}/decisions` behind the existing origin, session and membership checks. V1 commands carry `version`, a caller-chosen stable `operationId`, and `command`. The authenticated route supplies the actor and the route supplies the diagram scope. Unknown fields, including body-supplied role and actor, are invalid.

| Command            | Payload and effect                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ShareProposal`    | Takes `proposalId`, `relationshipId`, reviewed `contextFingerprint` and a `draft`. Manual drafts carry `kind: "manual"` and `content`. Check the current binding and persist the exact reviewed content as a proposed record. A model-assisted draft requires a server-bound draft reference that proves requester, scope and provenance. Its issuing path is deferred. |
| `AcceptProposal`   | Takes `proposalId` and exact `revision`. Check that it is awaiting review and its evidence is current. A current owner or editor can accept. Persist the accepting human and the reviewed record atomically.                                                                                                                                                            |
| `WithdrawProposal` | Takes `proposalId` and exact `revision`. Only the requester or current owner can withdraw an open proposal. Persist the withdrawing human. Withdrawal remains available when the relationship is missing or the binding is stale.                                                                                                                                       |

Content is a statement, rationale, a list of zero to three evidence items and a nullable open question. The first evidence variant is `{ "kind": "excerpt", "text": "…" }`. The context itself preserves the reviewed relationship and labels. The record includes a version, immutable ID, revision, relationship ID, bound context and fingerprint, reviewed content, requester, proposer and status. Manual provenance has `kind: "manual"`. Assisted provenance has `kind: "opy"` and a server-issued `runId`. An accepted record adds `acceptedBy`. A withdrawn record adds `withdrawnBy`.

Each share creates an immutable revision 1. Replacement uses withdrawal and a fresh proposal ID. Keep at most one open proposal and one accepted decision for a relationship. V1 closes that relationship to further shares after acceptance. Retain withdrawn and accepted records until the pilot capacity is reached. A fresh share fails with `DecisionCapacity` when the cap is hit. Bound request bodies and immutable records to 8 KiB each, the encoded record array to 32 KiB, and its count to 32. Reserve room for terminal attribution when admitting a proposal. Count UTF-8 bytes after encoding. Statement, rationale, each excerpt and the optional question have limits of 512, 2,048, 1,024 and 1,024 UTF-8 bytes respectively.

## Binding, receipts and compatibility

V1 context projects `recoveryVersion`, the relationship's ID, label and architecture, and the ordered source and target endpoints with node ID, port ID, node label and node architecture. Encode absent labels and architecture as null. Normalize the result through the existing canonical JSON operation binding and hash its UTF-8 bytes with SHA-256. Bind scope separately from the fingerprint through the route, aggregate key and receipt. Positions, sizes and unrelated records are excluded. The aggregate recomputes this binding at share and acceptance. Read authorizes access before disclosing either historical or current context.

The internal `RelationshipDecisionDecided` event contains `version`, `target`, `operationId`, `actorId`, `requestHash` and `outcome`. The hash binds the canonical JSON array `[target, actorId, request]`. A recorded outcome contains `status: "recorded"` and the record. A rejected outcome contains `status: "rejected"` and a machine-readable code. HTTP returns the outcome after authoritative commit or rejection. Invalid input uses HTTP 400, and missing or insufficient authentication follows existing 401/403 handling. Decision rejections include `ContextChanged`, `RelationshipMissing`, `ProposalNotOpen`, `RevisionMismatch`, `OperationIdMismatch` and `DecisionCapacity`.

Exact retries by the same authorized actor return the original outcome. Reusing the operation ID with another request returns `OperationIdMismatch`. Two acceptance requests race on the same proposal and record at most one accepting actor. Stamp the successful graph recovery's document version as `recoveryVersion`, defaulting to zero for older snapshots. Recovery keeps prior decisions and makes pre-recovery bindings historical even when the restored graph looks the same. Removing the relationship retains the historical record under its original ID.

Project every decision event to one ordinary v1 `noop` for legacy delta readers. This advances the source cursor without changing the document, graph coverage or assessments. The decision-enabled pilot uses the full-frame path and reads bounded decision records there. Graph-delta v1 bootstrap omits decision records to avoid caching an array that its no-op deltas cannot refresh. Disabled decision authoring retains a compatible reader for already-recorded decisions. Hosted activation depends on verifying event persistence and replay with the actual adapter and runtime.

## Evidence and handoff

The focused compatibility test feeds literal frames and v1 deltas through the current production codecs and reducer. It checks exact graph and assessment parity, cumulative source ordering, duplicate and gap handling, and additive full-frame decoding. It establishes what the current reader does with the fixtures. The native projection of a real decision event remains a milestone 2 test.

The original milestone 1 scenario failed at the missing route. The milestone 2 native check covers authenticated share and acceptance, peer and viewer reads, changed evidence, removal, concurrent reviewers, graph-only restore and old-client replay. The Playwright check uses dark and light browser contexts for two separate write-capable accounts, keyboard focus return and a narrow viewport. It compares graph exports before and after the decision journey.

```sh
cd apps/zloz-team
ZLOZ_RUN_OPY_CONTRACT=1 bun test test/runtime.test.ts --test-name-pattern 'OPY relationship decision'
```

The Worker defaults `ZLOZ_DECISION_AUTHORING` to false. Enabled diagrams advertise `decisionAuthoring` in bootstrap and get the full-frame stream. Disabling authoring preserves the full-frame read path for diagrams with records. The current composer supports human drafts. A server-issued model draft remains the next milestone.

Clef remains shadow-only outside this wire and persistence contract. FLUX is deferred.
