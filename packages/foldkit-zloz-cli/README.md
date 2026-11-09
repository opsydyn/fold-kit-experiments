# Foldkit Zloz CLI

An independent Effect CLI package for validating Zloz models and exporting
Mermaid bundles. **Local 0.1.0 candidate; not published to npm.** No Mermaid parser,
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
Input must be UTF-8, at most **1,048,576 bytes**, and a canonical version-one graph
snapshot, or `foldkit-zloz-model` v1 document. Example:

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
