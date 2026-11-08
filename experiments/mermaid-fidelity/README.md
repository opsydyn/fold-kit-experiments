# Mermaid fidelity spike

> Historical research, not the production Zloz CLI. The commands and independent
> lock below describe the original Flow-named qualification revision; they are
> not current installation instructions. See the [Zloz migration guide](../../docs/zloz-migration.md).
> The production CLI must use Effect CLI (`effect/cli`), typed errors, Schema
> decoding and scoped platform I/O; its implementation and qualification remain
> a separate roadmap slice. No Flow-named package is approved for release.

Private qualification code, outside the Bun workspace. Nothing here is published
or loaded by Flow core or the Astro demo. See [ADR 0007](../../docs/adr/0007-isolate-mermaid-fidelity-qualification.md)
and the [qualification report](../../docs/assessments/2026-11-08-flow-mermaid-fidelity-spike.md).

From the repository root:

```sh
bun run --filter @opsydyn/foldkit-flow pack:check
cd experiments/mermaid-fidelity
npm ci --ignore-scripts --no-audit --no-fund --workspaces=false
npm test
npm run test:bun
npm run qualify
node oracle.mjs
```

The browser oracle uses the repository's existing `apps/web` Playwright dependency
and installed Chromium. It serves local Mermaid modules on a temporary loopback
port, calls public `mermaid.parse`, closes its own server/browser and makes no
external requests. It does not use or stop the demo on port 4323.

`npm ci` requires the packed core tarball. The independent lock pins its exact
integrity; changing unreleased core source requires a deliberate lock refresh and
requalification. The root catalog and lock remain independent. Candidate versions
and resolved integrities are recorded in `evidence-node.json` and `evidence-bun.json`.
The official parser's transitive version inside `mermaid-ast` differs from the
explicit official-parser negative control; the lock records both.

## Scope and losses

| Input or fact                                                                                                  | Qualified behavior                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| flowchart/graph, four directions, literal quoted labels and Unicode                                            | Restricted import; TD normalizes to TB                                                                         |
| Rectangle, rounded rectangle, cylinder                                                                         | Preserve built-in outline choice                                                                               |
| Directed edges, cycles, self-loops, parallel named edges                                                       | Import; strip candidate's trailing `@` from named edge IDs                                                     |
| Unnamed edges                                                                                                  | Generate endpoint/occurrence-based IDs; reordering identical endpoint pairs can change identity                |
| Node/edge/port identity                                                                                        | Export safe aliases plus an explicit validated identity map; source alone cannot retain arbitrary IDs or ports |
| Comments                                                                                                       | Report omission; leading comments currently reject because the candidate cannot parse them                     |
| Style/class/link-style declarations, callbacks and links                                                       | Report omission; callbacks are never executed                                                                  |
| Layout, dimensions, anchors, port labels/order                                                                 | Report omission; deterministic grid/cardinal ports replace layout                                              |
| C4/DDD semantics, custom data, edge presentation and other authored fields                                     | Report omission on export; canonical Flow JSON remains authoritative                                           |
| Groups, group endpoints, other outlines, modern metadata, reverse/undirected arrows, HTML/markdown/icon labels | Reject rather than flatten or substitute                                                                       |
| Invalid syntax, stale/duplicate identity maps, excessive source/graph size                                     | Reject without a partial graph                                                                                 |

Source is limited to 32768 UTF-16 code units, 256 nodes and 512 edges. The CLI
request limit is 1048576 UTF-16 code units. These bound prototype inputs, not a
qualification for hostile workloads or parser execution time. Statement scanning
protects known losses but is not a complete grammar or a production feature gate.
Only quot/apos/amp/lt/gt and decimal Unicode label entities are qualified.

`lossPolicy: 'reject'` is the default. `'report'` permits documented losses, never
errors. Every result has versioned protocol, status and diagnostics with severity,
dimension, code, subject and nullable source location. Candidate parser errors
have no reliable structured location; they retain a bounded message with null
location. Scanner-detected declarations include their statement location.

Identity maps contain node/edge IDs, port IDs/kinds and endpoints only, not a
hidden copy of graph data. They require an exact matching node/edge set and
matching endpoints. Labels can be edited; changing topology requires a new map.
Tests compare declared identity/label/outline facts, not layout or whole documents.

## Read-only JSON driver

After building, send one request on stdin. It emits one JSON result and exits 0
for converted or 1 for rejected. It never writes a graph file.

```sh
printf '%s' '{"operation":"import","source":"flowchart LR\nA --> B","lossPolicy":"report"}' | node cli.mjs
```

Export accepts `{ "operation": "export", "document": "<versioned Flow JSON>",
"lossPolicy": "report", "direction": "LR" }`. SDK `exportFlowchart` instead
accepts an already validated Flow graph. Generated source and its `identity` map
must travel together if original identity matters. Diagnostics must stay visible
to callers; this prototype is not an npm adapter or a production CLI.
