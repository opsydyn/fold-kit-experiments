# Zloz and Alchemy Domain: integration review

2026-11-13. Product assessment and architecture/boundary challenge are **self-review**.
PNG is committed separately as `646d8da`. This record proposes a next slice;
it does not adopt a dependency or authorize provider execution.

## Product decision

**Reshape:** make an optional, version-pinned model-visualisation adapter a candidate
first-class integration. Keep the Zloz core independent of Alchemy. Start with a
read-only declaration-fidelity spike; defer backend control, code generation and
live event ingestion. Technical fit is plausible; runtime/fidelity and user value
are not yet qualified.

The intended progress is for an engineer and a domain expert to inspect what an
Alchemy model declares, discuss its boundaries, compare editions and share a
review packet or diagram without redrawing those declarations. Today the local
alternative is a manually authored Zloz graph or upstream documentation. The user
has requested this connection; no measured comprehension, maintenance cost or
representative-user task baseline exists. Demand beyond this request is unknown.

## trigger

A new shared adapter would cross a package/API ownership boundary and could be
mistaken for permission to execute business commands or infrastructure. This
review scopes the decision challenge to a read-only fidelity spike. Broader D/C/Q
core qualification remains open; PNG completion does not close it.

## proposal and claims

Observed locally: core Zloz contains C4, DDD and EventStorming meaning, controlled
editing, edition comparison/ghosts, review packets, Mermaid and SVG/PNG export.
`infra/zloz` already uses Alchemy beta.85 to host static workbench assets. That
hosting stack does not use Domain and is separate from this proposed integration.
See [architecture contracts](../../packages/foldkit-zloz/src/architecture.ts),
[hosting ownership](../../infra/zloz/README.md) and [the core audit](2026-11-12-zloz-core-completion-audit.md).

Upstream describes Domain as a business-model/runtime system. Its documentation
covers declarations and execution on multiple platforms. That is a domain
modelling connection, not a DNS/custom-domain request. [Domain overview](https://alchemy.run/domain/).

The exact published `@alchemy.run/domain@2.0.0-beta.85` manifest declares peers
Effect `^4.1.0`, Alchemy `2.0.0-beta.85`, and optional Foldkit `^0.170.0`. These
align with this checkout's versions. A manifest match is not a runtime pass.
Registry metadata and tarball integrity were checked without installing/importing
it. The inspected public declarations expose model members, aggregate definitions,
command event lists and view/policy sources. No runtime service was built.
See [inspection receipt](evidence/2026-11-13-alchemy-domain-metadata.json) and
[versioned upstream manifest](https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.85/packages/domain/package.json).

**Version drift matters:** the current website describes model annotations and
Query; the pinned beta.85 declarations inspected here have neither a model
`annotations` member nor a named Query export. The Foldkit page also mentions
`^0.169.0`, whereas the published manifest says `^0.170.0`. Use the published
artifact as the compatibility target and qualify every field used; do not infer
pinned support from current docs. [Annotations](https://alchemy.run/domain/annotations/),
[Foldkit integration](https://alchemy.run/domain/foldkit/).

## existing-platform ownership

Alchemy owns business command decisions, event storage/delivery, clients, runtime
validation and platform hosting. Its optional Foldkit adapter already supplies
API commands and read subscriptions. Reimplementing those in Zloz would duplicate
the execution layer. [Model semantics](https://alchemy.run/domain/model/),
[existing Foldkit adapter](https://alchemy.run/domain/foldkit/).

Zloz edition history records modelling snapshots and authored differences.
Alchemy's event history/backfill rebuilds business consumers. They have distinct
identities and effects: editor Undo or edition rewind must never replay, compensate
or delete backend business events. [Upstream history/backfill](https://alchemy.run/domain/backfill/).

## durable differentiated value

Inference: source-linked visual models, explicit conversion findings, portable
reviews and edition ghosts could make declared systems easier to communicate.
These capabilities exist locally, but the integrated workflow and improvement
over documentation/manual diagrams are unmeasured. No React Flow superiority or
validated USP claim follows from this review.

Candidate package: `@opsydyn/foldkit-zloz-alchemy` (proposed name only). It would
own the pinned Alchemy interpretation, provenance and mapping/loss findings. Core
would receive ordinary validated graphs; it would gain no Alchemy imports, peers,
provider setup, runtime handlers or framework-specific wire vocabulary. The app
would compose the package preview/review controls.

A caller could supply already-loaded trusted declarations, or a host-owned
versioned data-only descriptor. Loading a project's TypeScript can execute its
top-level code: accepting arbitrary module paths is outside this boundary. A CLI
would consume descriptors, not evaluate source. Retain package version, source
namespace/revision and explicit identity aliases; omit handlers, credentials,
instance state and event payloads. Metadata is not an authenticated source claim.

## strongest counterargument

A diagram that silently changes the meaning of a read model, saga or consistency
boundary is worse than the existing documentation. Upstream already exposes useful
model metadata, and Zloz's current role vocabulary cannot express every Domain
concept. Maintaining a beta-specific adapter could cost more than manual models.
Do not build a broad integration until a small pinned fixture demonstrates honest
coverage and understandable omissions.

## claim-to-evidence map

| Claim                                          | Current evidence                                                            | Gap                                                                                              | Required evidence                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declared topology is extractable               | Published beta.85 `.d.ts` members and sources inspected, integrity verified | No extractor/runtime run; completeness unknown                                                   | Compile against exact package; golden graph and source manifest; zero handler/service invocation                                                  |
| Dependencies can align                         | Published peers match checkout versions                                     | No installed adapter consumer or bundle test                                                     | Isolated Node/Bun/TypeScript consumer; root peer/dependency freedom                                                                               |
| Model/aggregate/event concepts fit             | Local DDD bounded-context, aggregate, domain-event roles                    | Source type vs instance identity and mixed-family relationship validity need qualification       | Explicit namespace/kind/tag IDs; duplicate, reorder and rename tests; no inferred business instances                                              |
| Commands and policies fit                      | Local EventStorming roles exist                                             | Lens choice/relationship meaning is not established                                              | Labelled mapping preview with per-item findings; no forced DDD coercion                                                                           |
| Views, projections, streams, sagas and Api fit | Source declarations exist; core lacks several matching native roles         | Missing semantic vocabulary, runtime routing/handler logic not derivable from declarations alone | Preserve as explicitly untyped source descriptors or unsupported findings; require an approved role contract before claiming semantic equivalence |
| History/export improves reviews                | Local editions/ghosts, packets and exports are implemented                  | No linked-model user task or drift evidence                                                      | Two declaration editions with stable identity; reviewers identify a known added/removed dependency without silent losses                          |

Do not infer strategic DDD upstream/downstream roles from technical message flow,
or merge declarations sharing a tag across contexts. A rename is remove/add unless
an explicit alias establishes continuity. Declared possible event production is
not evidence that a live business event occurred.

## minimum credible slice

Proposed appetite: **at most four engineering hours**, including qualification;
not an estimate or an authorization to implement now. Use one pinned, synthetic
bank fixture with an aggregate, commands/events, a view and a policy, plus a second
edition and an unsupported construct. Produce a detached source manifest, mapping
preview and golden canonical graph with visible gaps. No handlers, Layer builds,
command sends, store reads, live APIs or providers.

Primary technical measure: every source declaration/relation is either retained
with stable provenance or appears in a specific finding; zero silent omissions,
zero dangling edges, zero source mutation/execution. Compare reorder/duplicate/
rename and before/after fixtures. Manual-diagram effort and user comprehension
baselines are unknown; a later unassisted comparison task must measure whether
reviewers correctly locate the known change, not count clicks.

The decision at the end is whether to propose the separate adapter package and
small, justified core role enhancements. Cut live transport, source editing,
code generation, deployment and backend event playback from this slice. The
opportunity cost is delaying existing compatibility/device qualification; keep
the spike bounded instead of turning it into another backend framework.

## stop conditions

Stop and return findings within the appetite if extraction requires private
runtime stores, evaluating untrusted modules, executing handlers, a dependency
upgrade or silent semantic coercion. At two hours, if public-field coverage cannot
be demonstrated, spend the remainder recording the exact gap and alternatives;
do not widen scope. Do not expand into live integration merely because declarations
can be rendered. A failed identity/loss test blocks proposing full support.

## verdict

**proceed** — with the bounded read-only fidelity spike as a recommendation only.

## rationale

The published declaration surface and aligned peers justify a small reversible
qualification step. Source fidelity and vocabulary gaps prevent a full-integration
commitment. The adapter boundary preserves the core's headless contract and leaves
execution with Alchemy. User approval of this review is not npm publication,
provider activation, deployment or authority to run external business commands.

## evidence receipt

- **result:** review completed; Product Sense **reshape**, decision challenge
  **proceed** for the bounded candidate spike. All review is **self-review**;
  recommendation **needs review**.
- **claim:** an optional declaration adapter is a plausible fit, distinct from
  hosting or backend execution. First-class support is not implemented/qualified.
- **evidence:** dated primary documentation, exact registry manifest, integrity-
  checked public tarball declarations and local package/infra contracts. Only
  documentation/evidence files changed during this review.
- **remaining uncertainty:** runtime/API fidelity, vocabulary decisions, installed
  adapter compatibility, identity through refactoring and user-task value. No
  provider, hosted, security-isolation or business event replay claim.
- **next:** propose the version-pinned declaration-fidelity spike above; adopt or
  expand only after its findings are reviewed. Recommendation **needs review**.
