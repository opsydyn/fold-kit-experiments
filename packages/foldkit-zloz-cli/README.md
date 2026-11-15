# Foldkit Zloz CLI

An independent Effect CLI package for validating Zloz models, auditing relationships,
inspecting C4 receipts and exporting Mermaid bundles. **Local 0.1.0 candidate; not published to npm.** No Mermaid parser,
browser, Foldkit runtime or layout engine is installed by this package.

## Use in this workspace

```sh
bun run --filter @opsydyn/foldkit-zloz-cli build
node packages/foldkit-zloz-cli/dist/bin.mjs --help
node packages/foldkit-zloz-cli/dist/bin.mjs validate --input packages/foldkit-zloz-cli/evidence/example.json
node packages/foldkit-zloz-cli/dist/bin.mjs mermaid export -i packages/foldkit-zloz-cli/evidence/example.json --loss-policy report --direction TB
```

The packaged executable is `zloz`. After installing a qualified local tarball:

```sh
zloz validate -i diagram.json
cat diagram.json | zloz mermaid export --loss-policy report > diagram.mermaid.json
zloz mermaid export --help
```

Input defaults to stdin (`--input -`). Interactive stdin requires a file or pipe;
the command does not wait indefinitely for a terminal to supply a document.
Input must be UTF-8 and at most **1,048,576 bytes**. Validation and Mermaid export accept canonical v1/v2 snapshots and models;
audit, patch and packet commands select their explicit versioned contracts. C4 inspection uses
the independent receipt contract described below. Graph example:

```json
{ "version": 1, "graph": { "nodes": [], "edges": [] } }
```

Schema validates JSON syntax; the existing core codec validates graph semantics
and optional viewport metadata. Arbitrary raw node arrays are not documents.
Files are read through scoped streams and are never rewritten. The CLI has no
network commands and performs no layout. General Mermaid import is not shipped.

## Conversion and agent contract

`zloz validate` reports live node/edge counts without changing the input. For model documents it also reports model ID/name, edition count and immediate origin IDs. `zloz mermaid export`
calls the pure exporter. Non-empty diagrams have conversion losses: Mermaid
chooses layout, and source uses safe aliases. Losses reject by default. Opt in
with `--loss-policy report` to obtain source, identity metadata and explicit
diagnostics together. Conversion errors still reject in report mode.

Command results are one JSON value and newline on stdout:

```json
{
  "protocol": "foldkit-zloz-cli/v1",
  "operation": "validate",
  "status": "valid",
  "summary": { "nodes": 0, "edges": 0 },
  "diagnostics": []
}
```

Export uses `operation: "mermaid-export"`, `status: "converted"`, `data` containing
the existing Mermaid bundle and `diagnostics`. Rejected responses have
`status: "rejected"`, diagnostics and no converted data. Keep `data.identity` with
`data.source`: source alone cannot retain original node/edge/port identity.
The nested bundle deliberately retains its existing `foldkit-flow-mermaid/v1`
protocol and `flowId` fields for saved-data compatibility. All package names are
Zloz; no Flow-named package is approved for publication.

| Exit | Meaning                                                            | Output                                             |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------- |
| 0    | Valid document or successful conversion                            | JSON on stdout                                     |
| 0    | Explicit help, version, completions or implicit help               | Effect CLI output                                  |
| 1    | Conversion rejected, including errors in report mode               | JSON diagnostics on stdout                         |
| 2    | Invalid input, unavailable input, invalid UTF-8/JSON or byte limit | JSON diagnostics on stdout                         |
| 2    | Invalid invocation/options or unavailable output                   | JSON diagnostics on stderr; no help text on stdout |
| 130  | SIGINT interruption                                                | No fabricated completed result                     |

Directions are exactly `LR`, `RL`, `TB`, `BT`. Unknown flags and unsupported choices
fail before document I/O. Expected failures use typed exit-code markers and
already-rendered diagnostics; unexpected defects retain runtime reporting.
Shell redirection owns any output-file write; the CLI exposes no overwrite flag.

## Embed without starting a process

```ts
import { run } from '@opsydyn/foldkit-zloz-cli';
import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';

const program = run(['validate', '--input', 'diagram.json']).pipe(
  Effect.provide(NodeServices.layer),
);
```

`zlozCommand` is the typed Effect CLI command tree; `run` accepts explicit argv,
and `program` obtains argv from Effect Stdio. `readGraph`, `CliResponse`,
`CliDiagnostic`, typed errors and `cliProtocol` expose the integration contract.
Importing the package starts no runtime, opens no files and reads no stdin.
Only the executable supplies Node services and calls `NodeRuntime.runMain`.
Effect dependencies remain in this adapter and do not enter core or the pure
Mermaid package.

## Verification and release boundary

```sh
bun run --filter @opsydyn/foldkit-zloz-cli typecheck
bun run --filter @opsydyn/foldkit-zloz-cli test
bun run --filter @opsydyn/foldkit-zloz-cli pack:check
```

Tests qualify actual installed tarballs under Node and Bun, Bundler/NodeNext
types, stdout/stderr and 0/1/2/130 exits, file preservation, loss behavior, byte
limits, split UTF-8 and interruption cleanup. CI runs the same checks. The
publication selector and release automation do not enable this candidate yet;
publication is a separate explicit step. See [ADR 0016](../../docs/adr/0016-ship-a-standalone-effect-cli-for-zloz.md).

## Portable model documents

The workbench's **Export model with lineage** file is accepted directly:

```sh
zloz validate --input alternative.model.json
zloz mermaid export --input alternative.model.json --loss-policy report
```

Validation checks the entire model envelope, including edition snapshots and
pinned origin, through the core codec. Mermaid projects the current graph only.
Its `model-metadata-omitted` diagnostic explicitly records loss of model identity,
editions, lineage and capture camera; default strict policy rejects that loss.
Snapshot camera loss is reported as `viewport-omitted`, including empty graphs.
Report mode never permits invalid documents or unsupported graph conversion.
Keep model JSON as the authoritative copy. No input file is rewritten.

The injectable `readDocument` seam returns a tagged `CliDocument` preserving the
model or snapshot. Existing `readGraph` remains graph/snapshot-only and rejects a
model envelope with `model-projection-required`. Existing graph/snapshot validate
responses keep their original JSON shape; model validation adds a `model` summary.

## Causal relationship audit

```sh
zloz relationships audit --input diagram.json
cat model.json | zloz relationships audit > audit.json
zloz relationships audit -i model.json --rules conventions.json
zloz relationships audit --help
```

This is read-only and calls the core relationship audit. Graph/snapshot inputs
are audited directly. Model documents audit only their **current graph**, not
stored editions or lineage; the response identifies this scope and the model ID.
The full result is one JSON value and newline on stdout:

```json
{
  "protocol": "foldkit-zloz-cli/v1",
  "operation": "relationships-audit",
  "status": "audited",
  "scope": "current-graph",
  "modelId": null,
  "conventions": { "source": "builtin", "input": null },
  "data": {
    "status": "compatible",
    "summary": { "edges": 0, "typed": 0, "inferred": 0, "unrelated": 0, "blocked": 0 },
    "entries": []
  },
  "diagnostics": []
}
```

| Exit | Meaning                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------- |
| 0    | Complete audit with no blocked relationships. Typed, inferred and unrelated counts remain distinct. |
| 1    | Complete `audited` response with `data.status: incompatible` and per-edge semantic diagnostics.     |
| 2    | Rejected input, rules, invocation or I/O. This is not a semantic audit result.                      |

Each entry preserves edge ID/label and source/target port identity. Status is
`typed`, `inferred`, `unrelated` or `blocked`; code/message explain the result.
Typed/inferred entries carry architecture and relationship key. Blocked entries
retain any authored descriptor. Top-level diagnostics include blocked entries as
`relationship-<code>`, with the edge ID as subject and semantics/error dimensions.
Entries use canonical UTF-16 edge-ID order. Reports omit host-owned data and
callbacks. Neither a compatible result nor syntax-only `validate` certifies an
executable process, and inference never rewrites metadata.

`--rules` accepts a **complete replacement** catalogue, not a patch to defaults:

```json
{
  "version": 1,
  "rules": [
    {
      "architecture": { "family": "event-storming", "role": "custom", "name": "approves" },
      "sources": ["actor"],
      "targets": ["command"],
      "label": "Approves"
    }
  ]
}
```

Include every default/custom rule the model needs. Sources/targets support actor,
command, aggregate, domain-event and policy. DDD aggregate/aggregate-root and
domain-event nodes use the same interpretation as workshop notes. Unknown fields,
duplicate semantic keys, empty role sets/labels and invalid descriptors reject
with `invalid-rules`. Multiple compatible rules require explicit authored meaning;
the audit reports ambiguity instead of choosing one.

Rules files have their own 1,048,576-byte UTF-8 cap and use scoped streams. They
are read before the model and are never rewritten. `--rules -` is rejected because
stdin is reserved for model input. Configuration is data-only: no imports,
callbacks or code execution. Applications needing custom `roleOf` interpretation
can use the core API. The response records builtin/file provenance. Existing
validate/Mermaid response shapes are unchanged; audit is an additive v1 operation.

## Edition-aware audit comparison

```sh
zloz relationships compare --input model.json --baseline before
zloz relationships compare -i model.json --baseline before --edition after
cat model.json | zloz relationships compare --baseline before --rules conventions.json
```

This command requires a portable **model document** and an explicit baseline
edition ID. Omit `--edition` to target the current graph; supply it to target an
owned edition. Missing baseline/target IDs reject with `unknown-baseline` or
`unknown-edition`; graph/snapshot input rejects with `model-required`. There is no
automatic baseline, index-based selection, fallback or origin-edition traversal.
The same bounded data-only `--rules` catalogue audits both sides. Input files and
history remain unchanged.

One JSON value plus newline on stdout uses the existing protocol with operation
`relationships-compare`, status `compared`, scope `model-editions`, convention
provenance, `data` and `diagnostics`. Data includes:

- `modelId`, `status: regressed | no-new-findings` and count `summary`.
- `baseline` and `selected`, each with explicit `source` and a complete `audit`.
  Edition sources are `{ kind: 'edition', id, name }`; current is `{ kind: 'current' }`.
- `introduced` and `resolved` blocked audit entries, plus `persisting` pairs of
  `{ before, after }`. All arrays retain canonical edge-ID order.

Finding identity is edge ID plus diagnostic code. Changed codes resolve one
finding and introduce another; label, endpoint and message changes retain identity.
Deleting an edge resolves its finding; renaming its ID introduces a new finding.
These changes do not certify design correctness. Inferred/unrelated edges are
still visible in full audits and never counted as blocked findings.

| Exit | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| 0    | Complete comparison with no introduced findings. Persisting incompatibilities can remain. |
| 1    | Complete comparison with introduced findings and typed `CliAuditRegression`.              |
| 2    | Rejected input, selectors, rules, invocation or I/O.                                      |

Top-level diagnostics contain **introduced findings only**, as
`relationship-<code>` with edge ID subjects. Inspect `data.persisting` or the full
selected audit for existing incompatibilities. Use `relationships audit` when
the gate should reject **any** incompatibility. Same-edition comparisons are
valid and report all existing findings as persisting. The original audit command
and its exit semantics are unchanged.

See the [executable comparison evidence](evidence/relationship-comparison.md).

## Portable review packets

```sh
zloz review packet -i model.json --baseline before --loss-policy report > review.json
zloz review packet -i model.json --baseline before --edition after --direction TB --rules conventions.json --loss-policy report
cat model.json | zloz review packet --baseline before
```

The command composes the public packet builder in the optional Mermaid package.
It requires a model document and explicit owned baseline ID. Omit `--edition` to
review the current graph; provide it to choose an owned target edition. There is
no fallback to another edition or lineage traversal. The same bounded UTF-8 input
and data-only `--rules` contracts apply. No input file is rewritten.

One JSON response plus newline uses operation `review-packet`, status `created`,
scope `selected-snapshots`, `data: ZlozReviewPacket` and side-scoped conversion
`diagnostics`. `review.json` therefore contains the CLI envelope; its `data` is the
standalone packet (`format: foldkit-zloz-review`, `version: 1`). The packet retains
chosen snapshots, model/source identity, exact convention data, audit comparison,
projection options, both Mermaid bundles/identity maps and conversion diagnostics.
It contains no host file paths, executable rules, unrelated archive or lineage.
Chosen authored graph data and cameras are included. Keep the full JSON to retain
what Mermaid omits; a packet is not a full-model backup or an importable model file.

Mermaid omissions reject unless `--loss-policy report` explicitly consents. That
consent applies to both projections; errors still reject and no partial packet is
emitted. `--direction` supports LR/RL/TB/BT. Default direction is LR. Empty selected
snapshots with no camera can export under strict policy without losses.

| Exit | Meaning                                                                            |
| ---- | ---------------------------------------------------------------------------------- |
| 0    | Complete packet created, including packets with introduced or persisting findings. |
| 1    | Projection losses/errors rejected packet creation; no data is emitted.             |
| 2    | Rejected document, rules, selectors, invocation or I/O.                            |

Top-level diagnostics describe projections and carry `side: baseline | selected |
packet` where produced by the builder. Semantic findings are in
`data.comparison`. Use `relationships compare` to gate introduced findings or
`relationships audit` to gate any incompatibility; packet export is artifact
creation. `CliReviewInputRejected` distinguishes builder input/selector rejection
for embedders. Existing command output and exit meanings remain unchanged.

See the [packet type contract](../foldkit-zloz-mermaid/README.md#portable-review-packets)
and [executable evidence](evidence/review-packet.md).

## Validate and inspect review packets (unreleased)

```sh
zloz review validate --input review.packet.json
zloz review inspect --input review.packet.json
cat review.packet.json | zloz review validate
```

`review validate` emits `operation: "review-validate"`, `status: "valid"` with model,
baseline/selected identities, graph counts, audit status/counts and packet diagnostics.
`review inspect` emits `operation: "review-inspect"`, `status: "inspected"` with the
complete recomputed packet in `data`, including chosen snapshots, findings and Mermaid
projections as read-only data. No Mermaid execution, input-file write or model import
occurs. The existing strict package decoder checks the whole packet.

Both exit **0** for a valid packet, even when its audit is regressed or its projection
reports losses. This is validity checking, not a compatibility gate or new consent to
loss. Rejected/unsupported/inconsistent packets, IO and UTF-8 failures exit **2**.
These commands introduce no exit-1 case. Rejections retain decoder `code`, `message`
and JSON Pointer `path`; diagnostic `subject` is the file path or `-` for stdin.

Inputs must be raw `foldkit-zloz-review` v1 packets, as downloaded by the workbench.
CLI JSON responses wrap that document in `.data`; extract it explicitly:

```sh
zloz review packet -i model.json --baseline before --loss-policy report \
  | jq '.data' | zloz review validate
zloz review inspect -i review.packet.json | jq '.data.comparison.summary'
```

`jq` above is an optional host JSON tool, not a CLI runtime dependency. A creation or
inspection response envelope passed directly to validation rejects with
`unsupported-format`; it is not silently unwrapped. The shared scoped reader caps
both file and stdin input at **1,048,576 UTF-8 bytes**, decodes UTF-8 fatally and passes
raw text to the strict decoder before generic schema parsing. Packet depth/value
limits and duplicate-key checks therefore remain effective. The existing TTY guard
requires piped stdin or an explicit file.

Validation establishes self-consistency, not author authenticity. Inspection prints
packet data, which may be large within the input limit. Read-only workbench opening is implemented separately. See [ADR 0058](../../docs/adr/0058-inspect-review-packets-through-effect-cli.md)
and [command qualification](evidence/review-packet-read.md). PNG and Alchemy remain deferred.

## Modelling-patch dry run (unreleased)

```sh
zloz patch dry-run --input proposal.patch.json --source current.model.json \
  --session current-editor-session --revision 7
# Proposal stdin is also supported; only one input may consume stdin.
cat proposal.patch.json | zloz patch dry-run --source current.model.json \
  --session current-editor-session --revision 7
```

`--source` is a separately supplied canonical model document. Its ID/graph and the
explicit current `--session` / monotonic `--revision` form the source for dry run.
The CLI never infers the current source from a proposal's unsigned claims. Both
inputs use the existing 1 MiB byte-bound, fatal UTF-8 IO; proposal text goes directly
to the strict decoder for its declared v1/v2 version before generic domain parsing. No input file is changed.

The additive protocol v1 operation `patch-dry-run` emits `status: reviewed` and the
complete core preview in `data`, including target graph, source/provenance,
changes/losses/findings when available. Diagnostics retain exact paths and operation
IDs. Exit **0** means reviewable, including disclosed losses or no-op; **1** means a
decoded proposal cannot be reviewed against that source (stale/conflicting/invalid
target); **2** means decoding, IO, flags or input requirements failed. A response
is inspection data, not approval, Apply consent or authentication. There is no CLI
Apply or writable-agent execution. CLI publication remains a separate gate.

See [ADR 0062](../../docs/adr/0062-complete-reviewed-patch-cli-and-atomic-apply.md)
and [local qualification](../../apps/zloz-demo/evidence/p2-completion.md).

## DDD relationship audit (unreleased)

```sh
zloz ddd audit --input architecture.json
cat architecture.model.json | zloz ddd audit
zloz ddd audit -i architecture.json --rules ddd-rules.json
```

This command calls core `auditDddRelationships`. It audits the current graph of a
canonical graph/snapshot/model document; model responses include `modelId`, but
editions are not selected or compared. Typed DDD relationships are compatible or
blocked under the convention. Untyped and other-family edges are unrelated, never
inferred. No graph, source file, model history or Undo is modified.

Results use `protocol: "foldkit-zloz-cli/v1"`, `operation: "ddd-audit"`,
`status: "audited"`, `scope: "current-graph"`, `modelId`, `conventions`, `data` and
`diagnostics`. Data is the exact deterministic core report, including its summary
and every authored edge. Blocked entries add `ddd-relationship-<code>` diagnostics
with the edge ID as subject. Compatible means zero blocked DDD edges, not universal
DDD correctness or full typing; inspect `data.summary.typed/unrelated` for coverage.
Consumers should discriminate the response by operation as well as status.

| Exit | DDD audit meaning                                                           | Framing                                                     |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0    | Compatible convention audit, including empty/unrelated graphs               | One JSON value plus newline on stdout                       |
| 1    | DDD incompatibility                                                         | Completed audited report and semantic diagnostics on stdout |
| 2    | Invalid document/rules, unavailable input, UTF-8/JSON or byte-limit failure | Rejected JSON on stdout, no audit data                      |
| 2    | Invalid flags/subcommands                                                   | Invocation JSON on stderr; stdout empty                     |

Output failures, explicit help/version and SIGINT retain the existing CLI behavior.
A DDD-incompatible model is not malformed input. An invalid rule file never becomes
an incompatible model report.

Optional DDD rules use a separate version-one data-only format:

```json
{
  "version": 1,
  "rules": [
    {
      "architecture": {
        "family": "ddd",
        "scope": "tactical",
        "role": "custom",
        "name": "enriches"
      },
      "sources": ["aggregate-root"],
      "targets": ["domain-event"],
      "label": "Enriches",
      "direction": "directed"
    }
  ]
}
```

The catalogue **replaces** defaults. Direction is required (`directed` or
`symmetric`); current core rules enforce built-in direction and tactical/strategic
participant scope. Source/target roles are the nine supported DDD node roles,
including `read-model` and `bounded-context`. Unknown fields, invalid descriptors,
causal catalogues, duplicate rules and invalid role/scope combinations reject with
exit 2, even before an empty/unrelated model is read. No functions are accepted.

Both model and rules files use the existing independent 1 MiB UTF-8 input limit.
`--rules -` is rejected because stdin belongs to the model. Convention provenance
reports builtin or the supplied filename; it does not embed or hash the catalogue.
Keep the rule file to reproduce its convention. No report archive/decoder or
publication guarantee is added.

`zloz relationships audit` and `relationships compare` remain EventStorming-scoped,
with their existing rule format, output and exits. DDD comparison is available
below; DDD packets remain separately scoped. [Qualification](evidence/ddd-audit.md).

## DDD edition comparison (unreleased)

```sh
zloz ddd compare --input architecture.model.json --baseline before
zloz ddd compare -i architecture.model.json --baseline before --edition after
zloz ddd compare --baseline before --rules ddd-rules.json < architecture.model.json
```

Model documents are required. The baseline must be an owned edition; the target
is the current graph unless `--edition` explicitly selects another owned edition.
Unknown selectors reject; origin provenance does not make an edition selectable.
The existing version-one DDD rules schema and independent 1 MiB input limits apply.
Rules replace defaults and are validated before model reading, under one catalogue
for both sides. Existing causal commands and rule formats are unchanged.

The additive protocol-v1 `ddd-compare` operation has `status: "compared"`,
`scope: "model-editions"`, `conventions`, exact core comparison `data`, and
introduced-only `ddd-relationship-<code>` diagnostics. Findings match by edge ID and
code; changed codes resolve and introduce, while persisting findings retain both
projections. Reports are deterministic, detached and read-only. Convention provenance
records the rule filename; retain that file for reproduction.

| Exit | Meaning                                                                          | Output                                             |
| ---- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| 0    | No introduced findings, even if existing incompatibilities persist               | Compared JSON on stdout                            |
| 1    | Newly introduced findings (regression)                                           | Compared JSON and introduced diagnostics on stdout |
| 2    | Invalid input/rules, non-model input, unavailable/unknown edition or I/O failure | Rejected JSON on stdout; no comparison data        |
| 2    | Invalid invocation, including missing `--baseline`                               | Invocation JSON on stderr; stdout empty            |

Each expected response is one JSON value plus newline. Help/version, output failure
and SIGINT retain the existing CLI behavior. For complete target compatibility,
inspect `data.selected.audit.status`; exit 0 here is not the `ddd audit` compatibility
guarantee. No documents or Undo are changed, no report import/Apply or DDD packet
format is added, and no npm publication is performed. See
[workflow qualification](../../apps/zloz-demo/evidence/ddd-audit.md).

## Workshop participant rules (unreleased)

The core's additive workshop descriptors are accepted by normal document validation:
external-system participants, portless hotspots with required open/resolved status,
and portless lane groups. The original causal audit convention is unchanged.
Provide an explicit version-one `--rules` file to allow `external-system` in source
or target participant arrays (for example issues external-system → command).
`hotspot` and `lane` reject as causal catalogue roles. This preserves the meaning
of old builtin review packets; recognizing a descriptor does not automatically
expand the selected convention. Core exposes the data-only
`eventStormingWorkshopRelationshipRules` catalogue for consumers to serialize when
wanted. Existing UTF-8/JSON limits, input exits, DDD family separation and read-only
behavior are unchanged. Renderers and npm publication are separate gates.

## Inspect a portable C4 conversion receipt

```sh
zloz c4 receipt inspect --input payments.c4-conversion.json
cat payments.c4-conversion.json | zloz c4 receipt inspect
```

This read-only command selects the strict core v1 or v2 receipt decoder. It emits one
`foldkit-zloz-cli/v1` JSON response with operation `c4-receipt-inspect`, status
`inspected` and scope `recorded-conversion`. `data` contains:

- `format`, `version` and `authority: "read-only-evidence"`.
- `provenance`: complete source document, session and revision, including camera,
  editions and fork ancestry; `target`: the validated target document.
- `choices`: recorded C4 mappings and placements.
- `changes.nodes` and `changes.edges`: ID-sorted before/after history changes with
  semantic/layout classification.
- `losses`: recorded plan findings, including meaning, membership and constraint
  losses; `lossesAccepted: true` describes historical recorded acceptance only.

Loss findings also appear in `diagnostics` with severity `loss`. They do not make a
valid inspection fail. The command validates source/choices/target consistency,
not authorship or a historical human action. It never calls Apply, activates a
model, appends records, grants current consent or writes files.

Exit **0** means validated inspection; **1** means an explicitly unsupported string
format or numeric version (`incompatible-c4-receipt`); **2** means invalid input,
I/O, invocation or output failure. Core rejection uses `invalid-c4-receipt`;
UTF-8, malformed JSON, unreadable input and byte limits retain the shared diagnostic
codes. Rejected responses contain no inspection data. Unsupported versions are
classified before inspecting their payload. Incorrectly typed/missing format or
version fields are invalid data, not a readable future contract.

The existing CLI **1 MiB** input limit applies to files and stdin; the workbench's
**5 MiB** limit is separate. There are no layout, policy override or Apply flags.
See [qualification](evidence/c4-receipt-inspect.md) and
[ADR 0091](../../docs/adr/0091-inspect-c4-receipts-through-effect-cli.md).

## V2 compatibility inspection

```sh
zloz validate -i model-v2.json
zloz compatibility inspect -i model-v2.json
zloz mermaid export -i model-v2.json --loss-policy report
```

Validate accepts canonical v2 models and standalone v2 connection documents. Its
v2 response adds `documentVersion: 2` and explicit current `connectionMode`; legacy
v1 validation responses retain their exact shape. Compatibility inspection requires
a v2 model, checks current/edition/origin modes and reports package adapter gates
plus downgrade findings. It performs no downgrade, graph write or Apply.

V2 Mermaid output uses `foldkit-zloz-mermaid/v2`, with explicit bundle mode and
ordered endpoint identity. Source-only loose authoring rules, camera and model
metadata omissions require loss acceptance. Audit, patch dry-run and packet commands now support native v2 through explicit
versioned APIs. Invalid source/proposal versions, malformed data or inconsistent
evidence cannot bypass validation; see the native contract below. `readPortableDocument` exposes discriminated v1/v2
records for embeddings; `readDocument` and `readGraph` retain v1-only semantics.

## Native v2 authoring and read-only evidence

```sh
zloz ddd audit -i model-v2.json
zloz relationships compare -i model-v2.json --baseline baseline
zloz patch dry-run -i patch-v2.json --source model-v2.json --session tab-1 --revision 0
zloz review packet -i model-v2.json --baseline baseline --loss-policy report
zloz review inspect -i review-packet-v2.json
zloz c4 receipt inspect -i c4-conversion-v2.json
zloz ddd receipt inspect -i ddd-conversion-v2.json
zloz patch receipt inspect -i patch-receipt-v2.json
```

Model/standalone audits preserve v2 mode metadata; comparisons report both selected
checkpoint modes. Audit incompatibility/regression remains exit 1, independently
of structural loose-port eligibility. Patch proposals pin required source mode,
identity, session and revision. Dry run uses the independently supplied source and
never mutates it or performs Apply. Wrong source/proposal versions cannot silently
become v1; the decoder/dry-run reports the rejection.

Packet creation/inspection supports explicit v2 selected snapshots, audits and
Mermaid projections. Extract `response.data` to save the packet itself; the CLI
response envelope is not a packet. Native creation checks both package budgets and
the CLI's 1 MiB UTF-8 reopening limit before reporting success (`packet-limit`).

C4 and DDD receipt inspection accepts v1/v2; patch receipt inspection accepts v2.
These commands validate complete recorded evidence and return
`authority: read-only-evidence`. C4 adds explicit mode-change comparison; DDD/patch
return the validated complete receipt, including provenance, choices/proposal and
target, plus `data.review` with structured changes and loss findings. No receipt authorizes a new Apply. Unsupported receipt format/version is
exit 1; malformed/inconsistent/duplicate/deep data is exit 2. Input streams remain
bounded UTF-8. Dedicated receipt decoders inspect raw text before recursive domain
schemas. No write, network or Apply command is added.

The `readDocument`/`readGraph` embedding APIs remain v1-only and report an explicit
incompatibility for v2; use `readPortableDocument` for discriminated v1/v2 records.
