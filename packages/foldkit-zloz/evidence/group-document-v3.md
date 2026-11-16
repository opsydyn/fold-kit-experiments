# Standalone v3 group-document qualification

result: complete
claim: Core provides an explicit bounded v3 standalone document with capability-aware group graph validation, legacy standalone upgrade and refused ported downgrade. Legacy group invariants remain version-fixed.
evidence: Literal fixtures and `test/group-document-v3.test.ts`, shared legacy core regression tests, installed npm tarball Node/Bun execution and strict NodeNext/Bundler compile probes in `test/package.test.ts`, plus generated TypeDoc exports.
remaining uncertainty: This is local/package evidence. V3 editors, history/model archives, transactions/Undo, clipboard, patches/receipts/packets, CLI, layouts, image/Mermaid export and native interactions are not qualified or activated. No publishing or deployment occurred.
next: needs review; implement explicit v3 editor/session and capability-preserving transactions with source freshness/live veto/Undo before native group-port controls.

## Contract and public boundary

The wire envelope requires version 3, `coordinateSpace: 'world'`, explicit strict
or loose mode and exactly `capabilities: { groupPorts: boolean }`. The graph keeps
normal node/edge/port field identities and world coordinates. Group ports require
true capability even without edges. Generic, C4 system/container and DDD
aggregate/context boundaries qualify; lanes/hotspots remain portless. Shared graph
checks retain group-only acyclic parents, positive finite bounds, existing unique
identity and ordered endpoint eligibility.

Capture owns/freezes input without getters/toJSON. Unknown structural keys reject
at root/graph/node/port/geometry/edge/viewport boundaries; `data` remains JSON-only
extension metadata. Capture publishes native JSON number canonicalization so reopening agrees with
the returned value (including negative zero to zero), without changing the source.
The text reader bounds characters/depth/value count and decoded
duplicate keys before native JSON.parse. Limits may only tighten defaults and
canonical generated output must be reopenable within the same caps. Unsupported
version/capability/coordinate declarations have separate failure codes from
malformed syntax, limits or invalid documents. Invalid options throw. Only known
domain/syntax errors are converted; unexpected defects propagate.

Upgrading standalone v1 (including an unversioned snapshot) or v2 validates the
complete source and retains IDs, world positions, camera and explicit/defaulted
mode. Unknown fields and model/archive envelopes are not guessed or discarded.
Upgrade always starts with group ports disabled. Downgrade validates the whole
source and returns no `document` for any ported group. An otherwise valid portless
target is detached, remains v2 strict/loose and reports removal of enabled future
group-port authoring as a loss requiring caller review. Plans grant no Apply.

## Independent fixtures and failure probes

- `group-document-v3-ported.json`: child-first world positions, group output to
  ordinary input, exact `(500,230)` group anchor and camera preservation.
- `group-document-v3-loose.json`: ordered group input-to-input connection and DDD
  context metadata without inferred relationship semantics.
- `group-document-v3-portless.json` and `group-document-v1-portless.json`: independent
  literal legacy/target records, explicit upgrade and exact detached downgrade.
- Capability false/unconnected ports, invalid parents/cycles/duplicate IDs/ports,
  missing endpoints, ported lanes/ordinary hotspots, nonpositive geometry and
  invalid viewports reject. Supported C4/DDD group descriptors qualify.
- Unknown nested structural keys, unsupported declarations, escaped duplicate
  keys, malformed/trailing JSON, nonfinite exponents, accessor/toJSON/prototype/
  symbol/cycle inputs, oversized/deep/high-value payloads and tighter invalid
  options are exercised. Prototype-named metadata is retained without pollution.
- Escaped canonical output cannot exceed reopening caps. The source is detached
  and immutable; blocked decisions have no partial target. Known legacy readers
  and editor constructors reject the new envelope/ported graph.

## Shared machinery and installed evidence

`portable-data.ts` and `portable-json.ts` hold the shared bounded traversal/scanner.
The old patch ownership/text wrappers preserve original error classes, defaults
and messages. `validateGraphForConnectionMode` always binds group ports false;
the separate internal v3 entry receives only validated explicit capability.
Existing core regression tests cover old editor, grouping, parser, mode and receipt
behavior, not just new codec cases.

The existing cold tarball test installs core in a clean npm consumer without
Foldkit/Effect/React/ELK peers. A new `.mts` consumer imports the real v3 functions,
constants and types, checks anchor geometry, legacy rejection and detached
upgrade/downgrade, and executes compiled output under Node and Bun. Strict
NodeNext and Bundler compile probes include literal version/capability negative
contracts. The focused package qualification passed, and generated TypeDoc completed without
warnings. Full repository `bun run check`, `bun typecheck` and `bun run test`
passed; the final affected core typecheck also passed after canonical-number
normalization. The workspace run includes the current v3 cases and installed
consumer probes. Staged Moon verification is recorded at commit handoff.

This is not a new UI engine or an assertion of complete React Flow parity.
