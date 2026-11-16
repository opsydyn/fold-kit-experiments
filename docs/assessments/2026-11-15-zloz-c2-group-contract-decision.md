# Decision challenge: define the C2 group contract

result: complete
claim: Defined the recommended C2 group/endpoint contract and staged acceptance before runtime implementation.
evidence: Source inspection at 03284a8d, current official React Flow sub-flow/Node references, ADR 0105 with numerical geometry and compatibility cases, and valid local documentation links. Repository lint/format, full typecheck and full workspace tests passed for this documentation-only slice.
remaining uncertainty: Future v3 adoption cost, user acceptance of intentional coordinate/parent differences, proposed deferrals and all new runtime/adapter acceptance remain unresolved. No C2 completion, shipped group ports, publishing or deployment is claimed.
next: needs review; approve the proposed standalone v3 document/validation/upgrade/refused-downgrade slice before implementation.

## Trigger

C2 changes a graph invariant, parent ownership and a portable capability boundary.
This review covers the approved **definition**, not runtime implementation.
Source baseline: `03284a8d`; local source inspection and official React Flow docs
checked 2026-11-15. Architecture, delivery and test review are self-review.

## Proposal and claims

Retain world coordinates and explicit group ownership. Specify opt-in authored
group ports through an explicit future versioned document, keeping legacy readers,
portless defaults and collapsed proxies separate. Define policy/Undo and adapter
acceptance before permitting interactive editing. Record intentional differences;
do not declare full parity or accept unapproved exclusions.

## Existing-platform ownership

React Flow supplies its own parent-relative sub-flow/handle conventions; see the
[official sub-flow guide](https://reactflow.dev/learn/layouting/sub-flows) and
[Node reference](https://reactflow.dev/api-reference/types/node). ELK owns engine
layout computation. Foldkit owns messages, rendering and effect lifecycles.
No new framework, parser, package or infrastructure is justified by this contract.

## Durable differentiated value

Zloz owns a consistent portable system model, explicit authored versus derived
identity, live policy checks and immutable review/Undo boundaries. Group ports
should compose those mechanisms rather than bypass them in a renderer. Whether
this improves an unassisted architecture-modelling task is still unmeasured.

## Strongest counterargument

Group ports are a structural compatibility change with cascading editor, history,
layout and export costs. Another wire generation can repeat the v2 adoption cost.
Ordinary child ports already support valid boundary-crossing relationships. It is
not justified to promise all adapters, arbitrary parents or whiteboard-like shaped
containers merely to match an example catalogue.

## Claim-to-evidence map

| Claim                                    | Current evidence                                             | Gap                                                 | Required evidence                                                      |
| ---------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| World coordinates are existing semantics | `types.ts`, grouping/reparent transactions, `core.test.ts`   | Acceptance as an intentional parity difference      | Explicit disposition plus independent geometry fixtures                |
| Current groups are portless              | `graph.ts`, `port-edit.ts`, native inspector/anchor filters  | New permitted capability must not relax old readers | Literal old/new envelopes, unconnected group ports, downgrade failures |
| Authored ports and proxies differ        | `geometry.ts`, `group-presentation.ts`                       | Group-owned ports are not currently legal           | Identity, collapse visibility and ambiguity tests before gestures      |
| Policies and atomic Undo are reusable    | Group movement/deletion tests and native review transactions | New boundary/incident-edge veto coverage            | Whole-proposal rollback, stale/read-only/busy checks, one Undo         |
| Existing engines can be reused           | ELK compound branch and force eligibility gate               | Compound-node ports and v3 envelopes unqualified    | Real engine fixtures or explicit unsupported results                   |
| Better modelling UX                      | Product inference from designer/engineer freedom             | No measured task evidence                           | Later mounted task qualification, not a parity percentage              |

## Minimum credible slice

Define the preferred contract and a narrow first implementation target: standalone
v3 data validation, explicit upgrade and blocked downgrade with literal old-reader
fixtures. Do not add gestures, new editor modes or adapter claims in this planning
slice. [ADR 0105](../adr/0105-define-group-endpoints-and-coordinate-compatibility.md)
records the concrete semantics, numerical expected outcomes and staged acceptance.

Simplicity check:

- **Outcome:** one canonical coordinate/ownership contract with truthful group endpoints.
- **Options checked:** mixed relative/world storage; renderer-only sockets; hidden
  `data` fields; in-place v2 widening; explicit versioned capability.
- **Selected path:** retain world coordinates and explicit group kind; recommend
  a future v3 envelope for the new capability. No simultaneous derived positions.
- **Entanglement avoided:** shape does not imply ownership; port kind does not
  imply domain meaning; proxy rendering does not change authored endpoints.
- **Safeguards preserved:** old readers, per-port policies, exact source binding,
  atomic Undo and loss reporting.
- **Omitted scope:** runtime changes, arbitrary parenthood, shaped group geometry,
  adapter/version adoption, publishing and deployment.
- **Remaining uncertainty:** wire-generation adoption cost and user acceptance of
  the intentional differences. A simpler capability strategy needs equivalent
  independent old-reader rejection evidence before replacing this proposal.

## Stop conditions

Stop before runtime implementation without the next approval. Stop/reshape if
old readers accept and discard new meaning, serializers cannot represent an
accepted editor graph, a proxy becomes an authored target, coordinates are guessed
or any fallback silently deletes/retargets connections. Proposed deferrals are not
approved by this report.

## Verdict

proceed

## Rationale

Proceed with the documentation-only contract and acceptance matrix. The observed
invariants and risks are sufficiently clear to define a bounded implementation
proposal; they do not justify claiming a delivered capability. The next approval
can evaluate concrete versioning, ownership and compatibility costs before code.
