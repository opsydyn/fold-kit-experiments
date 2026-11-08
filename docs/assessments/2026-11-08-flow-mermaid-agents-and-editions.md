# Mermaid, agent authoring and editions: product assessment

The approved C4 renderer/demo slice is committed separately as `4b3835e`.

- **result:** complete
- **claim:** recommend first-class optional Mermaid conversion, a standalone CLI
  sharing its implementation, and durable graph editions separate from runtime
  replay. This document implements none of those features.
- **evidence:** current Flow contracts/C4 qualification, inspected FoldKit 0.170.0
  runtime/public devtools declarations, Tech Radar edition/comparison source and
  the primary sources linked below, checked 2026-11-08.
- **remaining uncertainty:** parser/backend suitability, conversion fidelity,
  customer authoring success and adoption are unvalidated. Proposed package names
  and budgets are recommendations, not accepted release commitments.
- **next:** a bounded Mermaid interoperability spike, then a decision on the
  first shipping adapter/CLI and edition-comparison slices.

## Product decision

**Pursue first-class Mermaid support; keep the CLI outside core.** Ship a shared
conversion library rather than put conversion logic only in a binary. Engineers
need the same behavior in a browser, an agent host, CI and a terminal.

The user-reported goal is authoring and reviewing architecture through both
people and agents. The inferred opportunity is a shared, inspectable graph
contract across text and canvas, with meaningful diffs, fresh editing policies and
reversible changes. That is a stronger proposition than a format checkbox.
External demand, time saved and willingness to switch remain unknown.

React Flow already offers an
[AI workflow editor template](https://reactflow.dev/ui/templates/ai-workflow-editor),
and its official navigation lists Undo/Redo examples. Therefore “AI workflows” or
“has Undo” cannot substantiate exclusive differentiation. Our proposed advantage
is a coherent authoring/review contract using FoldKit's Model/message lifecycle;
whether customers value it enough to switch still needs evidence. No exhaustive
competitor audit or comparative benchmark was conducted.

## Trigger

This proposal changes future package/public contracts and includes agent write
operations, persistence and product-comparison claims. The decision challenge
below evaluates those boundaries before implementation planning. Current C4
renderers are a separately approved and qualified implementation slice.

## Proposal and claims

Recommended boundaries, with names illustrative:

| Surface                         | Ownership                                                                               | Recommendation                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@opsydyn/foldkit-flow`         | Canonical graph/editor types, validation, geometry, editing policies and transactions   | Preserve the dependency-free root; no CLI, Mermaid runtime, model provider or persistence service      |
| `@opsydyn/foldkit-flow-mermaid` | Text ↔ graph mapping, parser boundary, diagnostics, ID maps and declared fidelity       | Optional reusable SDK; usable by UI and CLI                                                            |
| `@opsydyn/foldkit-flow-agent`   | Versioned machine schemas, capabilities, semantic operations, preview and guarded apply | Optional provider/transport-neutral SDK; package separately once CLI and embedded host both consume it |
| `@opsydyn/foldkit-flow-cli`     | Files/stdin/stdout, exit codes and explicit writes                                      | Standalone executable, thin wrapper over the shared SDKs                                               |
| Optional history entry in core  | Pure edition/diff contracts, without storage                                            | Prefer an optional subpath initially; persistence and playback UI remain host/optional-view concerns   |

Do not create all packages merely to reserve names. First prove the conversion
and operation contracts with consumers. Keep package releases compatible, but
let applications install only the capabilities they use. Publication remains a
later explicit release step under the existing repository process.

The CLI should provide discoverable help plus versioned JSON output for inspect,
validate, convert and diff. Add apply only when transactional/precondition rules
are qualified. Successful JSON belongs on stdout; structured errors and stable
exit codes must be usable without scraping prose. The same operation should
produce the same result in a CLI and an embedded agent host.

If “conversation” means natural-language diagram authoring as well as conversion,
the conversational layer should submit structured proposals through that SDK.
Do not require a particular model/provider or embed an LLM in the core. A CLI is
one transport; typed operations and results are the reusable agent capability.

## Existing-platform ownership

Mermaid owns its language and rendering ecosystem. Its official CLI generates
SVG/PNG/PDF; it does not itself establish our graph conversion contract. Its Node
API also has a separate stability caveat in the
[official README](https://github.com/mermaid-js/mermaid-cli).

Mermaid's documented `parse()` validates syntax and returns diagram-type
information. That is not a documented Flow graph/complete AST extraction API.
The upstream parser source inspected on this date does not include Flowchart in
its public `DiagramAST` union. A backend must be selected and tested rather than
assuming `@mermaid-js/parser` solves the problem.
[Public usage API](https://mermaid.js.org/config/usage),
[upstream parser source](https://github.com/mermaid-js/mermaid/blob/develop/packages/parser/src/parse.ts).
The latter is a moving upstream branch, not a qualification of a pinned npm
version. No dependency was installed or selected during this assessment.

FoldKit owns runtime replay, keyframes, paused rendering and command lifecycle.
Flow owns graph editing, validation, history and semantic graph differences.
Applications own stored editions, authorship, access rules and sharing. React
Flow's implementation does not determine these product boundaries.

## Durable differentiated value

Proposed user task: import a diagram from documentation, inspect/edit it on the
canvas, let an agent propose a change, review exactly what changed, and retain a
named edition that can be revisited. The same graph facts and permissions should
survive every step.

An agent-facing SDK needs more than `addNode` wrappers:

- Discoverable runtime schemas and capability descriptions, independent of a
  TypeScript build or a hosted provider.
- Stable caller-owned IDs and deterministic normalization, with explicit maps
  where a text format cannot represent arbitrary Flow IDs or port names.
- A preview/diff against an authoritative base, including validation and clear
  protection reasons. Preview success is not a cached permission grant.
- Atomic batches: either the current policy allows the complete proposal and
  it commits as one Undo step, or graph/history remain unchanged.
- Stale-base rejection. Live hosts use current editor revisions; file workflows
  need document/content identities rather than assuming a session revision
  survives process restarts. Apply rechecks both base and current permissions.
- No automatic external execution from diagram text. Host-controlled capabilities
  decide which writes are enabled. Runtime debugging dispatch is not the general
  product write API; semantic graph operations need their own validated boundary.

These are proposed contracts. Flow currently exposes typed events and policy-aware
edits; it does not yet expose a versioned machine operation decoder, general
atomic agent batches, or the CLI above.

## Mermaid fidelity contract

Canonical Flow JSON should remain the full document. Mermaid is an explicit text
projection/interchange format, not a second mutable source of truth.

Start the feasibility work with flowcharts. Declare supported syntax, Mermaid
version/dialect and graph mappings. Preserve node identity, labels and directed
connectivity for supported inputs. Quoting, Unicode, reserved words, parallel
edges, cycles and subgraphs must be in the test corpus. Unsupported input must
produce structured diagnostics, never silent omission or fabricated C4 meaning.

Current concrete gaps must shape the scope:

- Core outlines currently cover rectangle, rounded card and cylinder. Common
  flowchart diamonds/circles need qualified geometry/rendering or explicit
  unsupported/loss diagnostics. Calling every imported shape a rectangle would
  not establish first-class visual fidelity.
- Generic flowchart imports do not imply C4 semantics. They also need a general
  shape-aware presentation; setting a fake C4 role to get a renderer is invalid.
- Mermaid relationships can target subgraphs; Flow groups are portless. A future
  adapter needs an explicit mapping or rejection, not invented group ports.
- Layout coordinates, custom ports, host data and some semantic descriptors are
  not automatically represented in ordinary Mermaid syntax. Report losses and
  layout regeneration. A Flow sidecar can preserve data where users need exact
  round trips; do not hide that data inside the host's `node.data` namespace.
- Support explicit rejection/reporting policies for loss. Distinguish semantic,
  presentation and layout differences so callers can decide what is acceptable.

Mermaid C4 is a useful later dialect, but its official documentation explicitly
marks it experimental. Qualify it against a pinned version separately from the
typed Flow C4 contract. [Mermaid C4 documentation](https://mermaid.js.org/syntax/c4.html).

Do not promise all Mermaid diagram types, source-comment/formatting preservation,
or exact layout round trips in the first release. Sequences, ER diagrams and
state machines have semantics beyond generic graph conversion.

## Editions, rewind and change comparison

**Pursue durable editions as a product feature.** Keep these three layers explicit:

| Layer                | Current evidence                                                                                              | Proposed use                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Session Undo/Redo    | Flow already keeps bounded graph history                                                                      | Recover an editing transaction                                                     |
| Runtime time travel  | Installed FoldKit 0.170.0 exposes history/diff/replay/resume protocol and runtime keyframes                   | Inspect Model/message execution during development; reuse supported framework APIs |
| Named graph editions | Tech Radar has domain editions, playback and comparisons; Flow has no equivalent durable edition contract yet | Revisit and compare meaningful architecture versions across sessions               |

Observed local sources: FoldKit's installed `devTools/store`, public
`devtools-protocol`/`devtools-host` declarations and `runtime/devToolsIntegration`
show model reconstruction and replay/resume. The replay update path takes the
returned Model without running its returned Commands; paused rendering has its
own Mount lifecycle. This is not proof that arbitrary host integrations cannot
perform effects. Qualify external-write suppression and lifecycle behavior when
exposing replay in a product; do not deep-import internal runtime modules.

Tech Radar's [timeline](../../apps/tech-radar/src/radar/three/timeline.ts) computes
edition changes and playback, while its
[update](../../apps/tech-radar/src/radar/three/update.ts) handles selected editions
and comparisons. That domain feature is useful prior art. It is not evidence
that a persisted graph-edition feature already exists in Flow.

Proposed first history contract:

1. Caller-supplied named editions contain detached, validated graph snapshots and
   metadata. Do not serialize runtime handles, command functions, policies or
   the whole application Model. Keep durable history distinct from bounded Undo.
2. A pure diff matches stable node/edge IDs and reports added/removed elements,
   role/technology/data changes, labels, connections/ports and group membership.
   Keep position/size/route styling changes separately inspectable so a layout
   rearrangement does not obscure an architecture change.
3. A read-only preview/compare mode preserves the latest live editor separately.
   Scrubbing/playing old editions never silently overwrites current work.
   Offer side-by-side or overlay composition, with text summaries and reduced
   motion/keyboard controls from the outset.
4. Restore is a new explicit, validated edit against the current base/policies,
   with one Undo step and clear provenance. It is not “dispatch all old Messages”
   or replace the current Model with a stale runtime snapshot.

First demonstrate two editions and their difference. Timeline playback, branches,
multi-user history, remote storage and causal/audit claims follow only after the
snapshot/diff/restore contract is proven. Host persistence remains optional.

## Strongest counterargument

Format conversion and history can become a large compatibility product that
delays the architecture authoring experience. A standalone CLI alone can also
duplicate SDK logic, while many tiny packages create maintenance without a user
benefit. An imported diagram that loses its meaning will undermine the proposed
agent workflow even if the demo looks impressive.

Mitigation: validate one complete task with a small, explicit support matrix;
share conversion/operation code; keep parser and storage dependencies optional;
and treat unsupported semantics as visible product behavior. DDD renderers and
pattern insertion remain queued work, not silently completed by this proposal.

## Claim-to-evidence map

| Claim                                           | Current evidence                                            | Gap                                           | Required evidence                                                             |
| ----------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Optional packaging preserves a lightweight core | Packed root runs without FoldKit/Effect/layout dependencies | No conversion package exists                  | Packed adapter and CLI consumers, browser/headless import checks              |
| One converter can serve CLI and UI              | Existing pure graph/editor boundary                         | Parser and mapping unqualified                | Identical normalized results and diagnostics from both consumers              |
| Agent proposals can be reviewed and reversed    | Existing policies, revision checks and Undo                 | No general atomic operation batch/schema      | Rejection/stale-base/changed-policy tests and one-step Undo                   |
| Editions improve architecture review            | User request and Radar domain precedent                     | No Flow usability or adoption evidence        | A two-edition task distinguishing semantic and layout changes                 |
| Differentiation will matter to users            | Inferred coherent authoring/review proposition              | External demand and switching benefit unknown | Observed task completion and consumer glue removed, followed by user feedback |

## Minimum credible slice

**Proposed appetite: two engineering days for a feasibility slice, not a release
promise.** Use roughly the first half to choose/qualify a parser path and define
the loss/identity matrix; use the second half for a small headless import/export
prototype and a paired CLI/SDK fixture run. Do not spend that appetite on model
providers, a new MCP server, all diagram types or hosted services. No new feature
implementation is authorized by this assessment itself.

Use a dozen deliberately authored fixtures, including unsupported cases. Baseline
success rate and consumer effort are currently unknown. The primary acceptance
measure is preservation of declared semantic facts through import → edit →
export → reimport, with explicit diagnostics for everything outside the declared
contract. Guardrails: unchanged core dependency surface, no silent losses, no
unreviewed writes and no private runtime-store dependencies. Measure during that
prototype's qualification window; do not turn test-fixture success into a market
claim.

If the feasibility slice succeeds, approve separate shipping slices for the
adapter/shape-aware UI, schema/preview operations and thin CLI. A subsequent
bounded history slice should implement pure diff plus a read-only two-edition
demo before restore or playback. Revisit appetite at each boundary.

## Stop conditions

- Stop/reshape the converter if the supported subset cannot preserve declared
  identity/connectivity or its required parser would demand a broad grammar fork
  or browser-only extraction within this appetite. Export-first is a possible
  reduced scope; silent approximation is not.
- Stop the agent write slice if it bypasses current policies, accepts stale
  proposals, creates partial graph edits or needs generic devtools dispatch.
- Stop history delivery if preview loses latest work, restore cannot be undone,
  or replay can issue unintended external writes through the host integration.
- Reassess priority if the representative task still requires private imports,
  substantial consumer glue or users cannot distinguish semantic from layout
  changes. Do not expand the catalogue to hide a failed end-to-end task.

## Verdict

**proceed**

## Rationale

Proceed with bounded feasibility and explicit contracts. Packaging can support
first-class capability without making the parser, CLI or provider a mandatory
part of every canvas. Durable editions align well with the requested review
workflow, while FoldKit already owns runtime replay. The unproven part is useful,
faithful interoperability and customer benefit, so that is what the next slice
must test. Final recommendation: **needs review** before implementation.
