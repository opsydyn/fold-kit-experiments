# Optional Mermaid export and workbench preview

- **result:** complete
- **claim:** A pure optional exporter and opt-in workbench source preview/bundle download are implemented and locally qualified. No parser or UI framework enters the package.
- **evidence:** Package behavior and JavaScript boundary tests, a clean packed npm consumer, workbench update tests, production build, Chromium journey and independent Mermaid syntax checks, light/dark screenshots, and workspace gates recorded below.
- **remaining uncertainty:** Export is a restricted projection. Groups, empty labels and unqualified label syntax reject; no general import, rendering fidelity, screen-reader/device acceptance, hosted deployment or registry publication is claimed.
- **next:** Add explicit nested subgraph export so the C4 container example can be projected without flattening its boundaries, preserving identity and loss reporting.

## Contract and package ownership

`@opsydyn/foldkit-flow-mermaid` owns `exportMermaid`, versioned bundle/identity
metadata and typed diagnostics. It has only a matching Flow core peer and no
runtime dependencies. Core owns validation and the graph; the host owns loss
consent, preview and download. See [ADR 0008](../../../docs/adr/0008-export-mermaid-through-an-optional-package.md)
and the [public package contract](../../../packages/foldkit-flow-mermaid/README.md).

Default loss policy rejects a non-empty lossy projection and supplies diagnostics
without a partial value. Explicit report mode allows losses, never errors. The
bundle keeps source, identity metadata and diagnostics together. Source aliases
are deterministic and edges explicitly named; the map includes unused ports but
no hidden original graph. C4/DDD meaning, host data, layout and presentation are
reported as omitted. Flow JSON remains authoritative.

The workbench preview is closed by default and independently closable. Native
checkbox/buttons, an expanded-state trigger, a labelled region, status text and
focusable source support keyboard use. Conversion feedback remains visible when
the user explicitly opens it in minimal mode. This is separate from optional
canvas measurement diagnostics. Opening, consenting and downloading preserve the
graph and history. Downloads execute in a FoldKit Command. Consent clears on any
graph change, including loading an example whose revision counter restarts.

## Local qualification

| Check                   | Evidence                                                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export behavior         | Exact encoded source and identities for Unicode/quotes/entities, named parallel edges, deterministic detached results, strict losses, all built-in outlines/directions, invalid graphs/groups/labels, inclusive UTF-16 source bound and empty graph |
| JavaScript API boundary | Null/primitive/array/invalid options and malformed graphs return structured rejection with no value                                                                                                                                                 |
| Packed npm consumer     | Core/exporter tarballs installed with offline npm; strict TypeScript Bundler/NodeNext; actual Node and Bun execution; no Astro/React/FoldKit/Effect/ELK/Mermaid/parser dependency; licences and package allowlist checked                           |
| Workbench update        | Preview/consent/download preserve editor identity; blocked downloads return no command; edits and graph replacement invalidate consent; grouped C4 remains rejected                                                                                 |
| Browser journey         | Download inspected for original identities, diagnostics and source; graph snapshot unchanged; light/dark, minimal mode, consent reset, group rejection and close control exercised                                                                  |
| Syntax oracle           | Pinned Mermaid 12.3.0 public `parse` in Chromium accepts seven generated cases: C4 workbench, empty graph, escaped literal and three outlines in all four directions                                                                                |
| Visual evidence         | [Light](./mermaid-export-light.png), [dark](./mermaid-export-dark.png), both inspected                                                                                                                                                              |

The browser uses the installed private spike's pinned Mermaid modules as an
independent oracle, served only over a temporary loopback server. Mermaid is not
part of the built application. No page errors or external requests were observed.
An empty node label initially generated invalid Mermaid and failed this oracle;
the package now rejects empty node/edge labels explicitly, with regression tests.
Raw HTML characters are entity encoded rather than executed. Unsupported control
characters, malformed Unicode and icon-like text also reject.

Reproduce after installing the private spike dependencies as described in its
README and building the production sample:

```sh
bun run --filter @opsydyn/flow-sample build
node apps/flow-sample/evidence/mermaid-export-browser.mjs
```

`mermaid-export-browser.json` is host-captured browser output. The source/evidence
fingerprint is in `mermaid-export-sources.json`. This ledger is an agent-maintained
local evidence summary, not independent review, CI or publication proof.

## Review and final gates

Self-review covered package architecture, delivery and test quality. Public types
and npm metadata follow optional package conventions. The core dependency surface
and persisted graph schema are unchanged. CI now includes the exporter consumer
checks; the publish workflow is unchanged. The package README marks publication
pending and documents projection/rejection behavior.

A meaningful regression exposed consent incorrectly surviving replacement with an
equal revision number. It failed before centralized graph-change invalidation and
passes afterward. The external syntax oracle independently exposed empty labels.
An early consumer check was invalidated by overlapping builds that clean shared
core declarations; sequential reruns are used for the final evidence.

Host execution on 2026-11-08 completed with exit 0 for `bun run test`,
`bun typecheck`, `bun run check`, the production sample build and the final browser
journey. The exporter has 8 passing tests (including its packed consumer); the
sample has 12 passing tests. Package `pack:check` runs publint and Are The Types
Wrong as part of the consumer test. Root lint has advisory warnings and no errors;
format/catalog checks pass. An initial formatting-only failure in the sample
manifest was corrected before the final check.

The demo at http://127.0.0.1:4323 serves the refreshed production build. A separate
Chromium smoke checks HTTP 200 and opens its Mermaid preview. The browser journey
uses its own temporary local server, which it closes afterward.

Recommendation: **needs follow-up** for nested subgraphs and broader fidelity.
No PR, publication, provider integration or deployment was performed.
